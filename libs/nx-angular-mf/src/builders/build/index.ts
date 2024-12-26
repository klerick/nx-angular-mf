import { BuilderContext, createBuilder } from '@angular-devkit/architect';

import { BuildExecutorSchema } from './schema';

export async function* runBuilder(
  options: BuildExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run build mf');
  yield {
    success: true,
  };
}

export default createBuilder(runBuilder);
