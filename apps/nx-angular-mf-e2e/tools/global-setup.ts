import { spawn, ChildProcess } from 'node:child_process';

interface ServerInfo {
  process: ChildProcess;
  pid: number;
}

const servers: ServerInfo[] = [];

const waitForHttp = (url: string, timeout = 180000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Server not ready
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, 2000);
      }
    };

    check();
  });
};

const runServe = async (app: string, port: number) => {
  console.log(`Starting server "${app}" on port ${port}...`);

  const server = spawn('npx', ['nx', 'serve', app], {
    detached: true,
    stdio: 'ignore',
  });

  server.unref();

  servers.push({
    process: server,
    pid: server.pid!,
  });

  await waitForHttp(`http://localhost:${port}/`);
  console.log(`Server "${app}" ready on port ${port}`);
};

export async function setup() {
  console.log('\nSetting up...\n');

  await runServe('mf1-application', 4201);
  await runServe('host-application', 4200);
}

export async function teardown() {
  console.log('\nTearing down...\n');

  for (const { process: server, pid } of servers) {
    if (server && pid) {
      try {
        server.kill('SIGTERM');
        console.log(`Sent SIGTERM to process ${pid}`);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          process.kill(pid, 0);
          server.kill('SIGKILL');
          console.log(`Sent SIGKILL to process ${pid}`);
        } catch {
          console.log(`Process ${pid} has been terminated`);
        }
      } catch (error) {
        console.warn(`Failed to kill process: ${error}`);
      }
    }
  }
}