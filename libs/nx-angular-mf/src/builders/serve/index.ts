import { BuilderContext, createBuilder } from '@angular-devkit/architect';

import { ServeExecutorSchema } from './schema';

export async function* runBuilder(
  options: ServeExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run serve mf');
  yield {
    success: true,
  };
}

export default createBuilder(runBuilder);
