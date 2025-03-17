import { toast } from 'react-toastify';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';

interface DeploymentOptions {
  token: string;
  chatId: string;
  setIsDeploying: (value: boolean) => void;
}

export async function handleNetlifyDeploy({ token, chatId, setIsDeploying }: DeploymentOptions) {
  if (!token) {
    toast.error('Please connect to Netlify first in the settings tab!');
    return null;
  }

  if (!chatId) {
    toast.error('No active chat found');
    return null;
  }

  try {
    setIsDeploying(true);

    const artifact = workbenchStore.firstArtifact;

    if (!artifact) {
      throw new Error('No active project found');
    }

    const actionId = 'build-' + Date.now();
    const actionData: ActionCallbackData = {
      messageId: 'netlify build',
      artifactId: artifact.id,
      actionId,
      action: {
        type: 'build' as const,
        content: 'npm run build',
      },
    };

    // Add and run the build action
    artifact.runner.addAction(actionData);
    await artifact.runner.runAction(actionData);

    if (!artifact.runner.buildOutput) {
      throw new Error('Build failed');
    }

    const fileContents = await getBuildFiles(artifact.runner.buildOutput.path);
    const existingSiteId = localStorage.getItem(`netlify-site-${chatId}`) || undefined;

    // Deploy to Netlify
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: existingSiteId,
        files: fileContents,
        token,
        chatId,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok || !data.deploy || !data.site) {
      console.error('Invalid deploy response:', data);
      throw new Error(data.error || 'Invalid deployment response');
    }

    // Poll for deployment status
    const deploymentStatus = await pollDeploymentStatus(data.site.id, data.deploy.id, token);

    // Store the site ID if it's a new site
    if (data.site) {
      localStorage.setItem(`netlify-site-${chatId}`, data.site.id);
    }

    const deployUrl = deploymentStatus.ssl_url || deploymentStatus.url;
    toast.success('Deployed successfully! View site: ' + deployUrl);

    return {
      site: data.site,
      deploymentUrl: deployUrl,
    };
  } catch (error) {
    console.error('Deploy error:', error);
    toast.error(error instanceof Error ? error.message : 'Deployment failed');
    throw error;
  } finally {
    setIsDeploying(false);
  }
}

async function getBuildFiles(buildPath: string): Promise<Record<string, string>> {
  const container = await webcontainer;
  buildPath = buildPath.replace('/home/project', '');

  async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        const content = await container.fs.readFile(fullPath, 'utf-8');
        const deployPath = fullPath.replace(buildPath, '');
        files[deployPath] = content;
      } else if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        Object.assign(files, subFiles);
      }
    }

    return files;
  }

  return getAllFiles(buildPath);
}

async function pollDeploymentStatus(siteId: string, deployId: string, token: string) {
  const maxAttempts = 20;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const status = (await response.json()) as any;

      if (status.state === 'ready' || status.state === 'uploaded') {
        return status;
      }

      if (status.state === 'error') {
        throw new Error('Deployment failed: ' + (status.error_message || 'Unknown error'));
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Status check error:', error);
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Deployment timed out');
}
