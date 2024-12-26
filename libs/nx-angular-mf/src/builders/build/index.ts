import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { buildApplication } from '@angular-devkit/build-angular';

import { BuildExecutorSchema } from './schema';


export async function* runBuilder(
  options: BuildExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run build mf');

  const { mf: defaultOptionsMfe, ...defaultOptions } = options;

  const extensions = {
    codePlugins: [],
    indexHtmlTransformer: (input) => {
      return input;
    },
  };

  yield* buildApplication(defaultOptions as any, context, extensions);
}

export default createBuilder(runBuilder);
