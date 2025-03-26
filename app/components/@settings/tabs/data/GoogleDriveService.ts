/**
 * Google Drive integration for Bolt backups
 * Handles authentication, file upload, download, and management
 */

/*
 * Google API Client ID - in production this should be an environment variable
 * Get this from Google Cloud Console: https://console.cloud.google.com/
 *
 * IMPORTANT: To use Google Drive integration:
 * 1. Go to Google Cloud Console and create a project
 * 2. Enable the Google Drive API
 * 3. Create OAuth 2.0 credentials (Web application type)
 * 4. Add your app's domain to authorized JavaScript origins
 * 5. Copy the API Key and Client ID below
 */
const API_KEY = ''; // ADD YOUR API KEY HERE
const CLIENT_ID = ''; // ADD YOUR CLIENT ID HERE
const API_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const BACKUP_FOLDER_NAME = 'Bolt Backups';

// Google API client variables
let gapiInited = false;
let gisInited = false;
let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;

// Define TokenClient interface
interface TokenClient {
  requestAccessToken: (options?: { prompt: string }) => void;
}

// Interface for Google Drive backup metadata
export interface GoogleDriveBackup {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size: string;
  webViewLink?: string;
}

/**
 * Initializes the Google API client
 */
export async function initGoogleDriveApi(): Promise<boolean> {
  if (gapiInited && gisInited) {
    return true;
  }

  try {
    // Load the Google API client script if not already loaded
    if (!window.gapi) {
      await loadScript('https://apis.google.com/js/api.js');
    }

    // Load the Google Identity Services script if not already loaded
    if (!window.google?.accounts) {
      await loadScript('https://accounts.google.com/gsi/client');
    }

    // Initialize the gapi client
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('client', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Failed to load Google API client')),
      });
    });

    // Initialize the gapi client with the API key and discovery doc
    await window.gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });

    gapiInited = true;

    // Initialize the Google Identity Services client
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: API_SCOPE,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          throw new Error(tokenResponse.error);
        }

        accessToken = tokenResponse.access_token;
      },
    });

    gisInited = true;

    return true;
  } catch (error) {
    console.error('Google Drive API initialization failed:', error);
    return false;
  }
}

/**
 * Loads a script dynamically
 */
function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

/**
 * Authenticates with Google Drive and requests token
 */
export async function authenticateWithGoogleDrive(immediate = false): Promise<boolean> {
  // Make sure API is initialized
  if (!gapiInited || !gisInited) {
    const initialized = await initGoogleDriveApi();

    if (!initialized) {
      return false;
    }
  }

  // If tokenClient is still not initialized, fail
  if (!tokenClient) {
    return false;
  }

  // Request an access token
  try {
    if (immediate) {
      tokenClient.requestAccessToken({ prompt: '' });
    } else {
      tokenClient.requestAccessToken();
    }

    return accessToken !== null;
  } catch (error) {
    console.error('Google Drive authentication failed:', error);
    return false;
  }
}

/**
 * Checks if user is authenticated with Google Drive
 */
export function isAuthenticatedWithGoogleDrive(): boolean {
  return accessToken !== null;
}

/**
 * Revokes the current Google Drive access token
 */
export function revokeGoogleDriveAccess(): void {
  if (accessToken) {
    // Revoke the access token
    window.google?.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      console.log('Google Drive access token revoked');
    });
  }
}

/**
 * Gets or creates the Bolt backups folder
 */
async function getOrCreateBackupsFolder(): Promise<string | null> {
  try {
    // Check if the backups folder already exists
    const response = await window.gapi.client.drive.files.list({
      q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    if (response.result.files && response.result.files.length > 0) {
      // Folder exists, return its ID
      return response.result.files[0].id;
    }

    // Folder doesn't exist, create it
    const metadata = {
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const createResponse = await window.gapi.client.drive.files.create({
      resource: metadata,
      fields: 'id',
    });

    return createResponse.result.id;
  } catch (error) {
    console.error('Failed to get or create backups folder:', error);
    return null;
  }
}

/**
 * Uploads a backup to Google Drive
 */
export async function uploadBackupToGoogleDrive(
  backupData: Record<string, any>,
  filename: string,
): Promise<GoogleDriveBackup | null> {
  try {
    // Authenticate if needed
    if (!isAuthenticatedWithGoogleDrive()) {
      const authenticated = await authenticateWithGoogleDrive();

      if (!authenticated) {
        throw new Error('Not authenticated with Google Drive');
      }
    }

    // Get or create the backups folder
    const folderId = await getOrCreateBackupsFolder();

    if (!folderId) {
      throw new Error('Failed to get or create backups folder');
    }

    // Create the file metadata
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId],
    };

    // Convert the backup data to a blob
    const content = JSON.stringify(backupData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    // Upload the file
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    // Use fetch API to upload the file
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = (await response.json()) as { id: string };

    // Get the file details
    const fileDetails = await getFileDetails(result.id);

    return fileDetails;
  } catch (error) {
    console.error('Failed to upload backup to Google Drive:', error);
    return null;
  }
}

/**
 * Downloads a backup from Google Drive
 */
export async function downloadBackupFromGoogleDrive(fileId: string): Promise<Record<string, any> | null> {
  try {
    // Authenticate if needed
    if (!isAuthenticatedWithGoogleDrive()) {
      const authenticated = await authenticateWithGoogleDrive();

      if (!authenticated) {
        throw new Error('Not authenticated with Google Drive');
      }
    }

    // Use fetch API to download the file
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    // Parse the response as JSON with type assertion
    const backupData = (await response.json()) as Record<string, any>;

    return backupData;
  } catch (error) {
    console.error('Failed to download backup from Google Drive:', error);
    return null;
  }
}

/**
 * Gets details of a Google Drive file
 */
async function getFileDetails(fileId: string): Promise<GoogleDriveBackup | null> {
  try {
    const response = await window.gapi.client.drive.files.get({
      fileId,
      fields: 'id, name, createdTime, modifiedTime, size, webViewLink',
    });

    // Add type assertion to response.result
    const result = response.result as {
      id: string;
      name: string;
      createdTime: string;
      modifiedTime: string;
      size: string;
      webViewLink: string;
    };

    return {
      id: result.id,
      name: result.name,
      createdTime: result.createdTime,
      modifiedTime: result.modifiedTime,
      size: result.size,
      webViewLink: result.webViewLink,
    };
  } catch (error) {
    console.error('Failed to get file details:', error);
    return null;
  }
}

/**
 * Gets all backups from Google Drive
 */
export async function getGoogleDriveBackups(): Promise<GoogleDriveBackup[]> {
  try {
    // Authenticate if needed
    if (!isAuthenticatedWithGoogleDrive()) {
      const authenticated = await authenticateWithGoogleDrive(true);

      if (!authenticated) {
        return [];
      }
    }

    // Get the backups folder
    const folderId = await getOrCreateBackupsFolder();

    if (!folderId) {
      return [];
    }

    // Get all files in the backups folder
    const response = await window.gapi.client.drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, createdTime, modifiedTime, size, webViewLink)',
      orderBy: 'createdTime desc',
    });

    if (!response.result.files || response.result.files.length === 0) {
      return [];
    }

    return response.result.files.map(
      (file: {
        id: string;
        name: string;
        createdTime: string;
        modifiedTime: string;
        size: string;
        webViewLink: string;
      }) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        size: file.size,
        webViewLink: file.webViewLink,
      }),
    );
  } catch (error) {
    console.error('Failed to get backups from Google Drive:', error);
    return [];
  }
}

/**
 * Deletes a backup from Google Drive
 */
export async function deleteGoogleDriveBackup(fileId: string): Promise<boolean> {
  try {
    // Authenticate if needed
    if (!isAuthenticatedWithGoogleDrive()) {
      const authenticated = await authenticateWithGoogleDrive();

      if (!authenticated) {
        throw new Error('Not authenticated with Google Drive');
      }
    }

    // Delete the file
    await window.gapi.client.drive.files.delete({
      fileId,
    });

    return true;
  } catch (error) {
    console.error('Failed to delete backup from Google Drive:', error);
    return false;
  }
}

// Add these interfaces for the Google API
declare global {
  interface Window {
    gapi: {
      load: (api: string, options: { callback: () => void; onerror: (error: any) => void }) => void;
      client: {
        init: (options: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        drive: {
          files: {
            list: (options: any) => Promise<any>;
            create: (options: any) => Promise<any>;
            get: (options: any) => Promise<any>;
            delete: (options: any) => Promise<any>;
          };
        };
      };
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
          }) => TokenClient;
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}
