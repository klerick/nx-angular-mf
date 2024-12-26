import { PromiseExecutor } from '@nx/devkit';
import { IndexExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<IndexExecutorSchema> = async (options) => {
  console.log('Executor ran for build', options);
  return {
    success: true,
  };
};

export default runExecutor;
