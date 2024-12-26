import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { buildApplication } from '@angular-devkit/build-angular';

import { BuildExecutorSchema } from './schema';
import { getMapName, prepareConfig } from '../helpers';


export async function* runBuilder(
  options: BuildExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run build mf');

  const { mf: defaultOptionsMfe, ...defaultOptions } = options;

  const optionsMfe = await prepareConfig(defaultOptionsMfe, options, context);

  const mapShareObject = getMapName(
    optionsMfe.shared,
    optionsMfe.sharedMappings
  );

  defaultOptions.externalDependencies = [...mapShareObject.values()].map(
    (i) => i.packageName
  );

  const extensions = {
    codePlugins: [],
    indexHtmlTransformer: (input) => {
      return input;
    },
  };

  yield* buildApplication(defaultOptions as any, context, extensions);
}

export default createBuilder(runBuilder);
