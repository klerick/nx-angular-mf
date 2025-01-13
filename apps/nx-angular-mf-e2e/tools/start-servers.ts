import { spawn } from 'child_process';

const controller = new AbortController();
const { signal } = controller;
global.abortCcontrollerInst = controller;

const runServe = async (app: string) => {
  return new Promise((resolve, reject) => {
    let isStarted = false;
    const nxProcess = spawn('npx', ['nx', 'serve', app], {
      stdio: ['pipe', 'pipe', 'inherit'],
      signal,
    });

    nxProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      if (output.includes('generation complete')) {
        isStarted = true;
        resolve(nxProcess);
      }
    });

    nxProcess.on('error', (error) => {
      reject(error);
    });

    nxProcess.on('close', (code) => {
      if (!isStarted) {
        reject(new Error(`Process exited before starting (code ${code})`));
      }
    });
  });
};

export default async () => {
  await runServe('mf1-application');
  await runServe('host-application');
};
