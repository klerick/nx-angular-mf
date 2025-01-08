import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { buildApplication } from '@angular-devkit/build-angular';
import { Plugin } from 'esbuild';

import { BuildExecutorSchema } from './schema';
import { getMapName, indexHtml, loadModule, prepareConfig } from '../helpers';
import {
  entryPointForExtendDependencies,
  importMapConfigPlugin,
  serverSSRPlugin,
  moveCustomLoaderPlugin,
  changePathForAngularSsrNode,
} from '../es-plugin';

export async function* runBuilder(
  options: BuildExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run build mf');

  const { mf: defaultOptionsMfe, ...defaultOptions } = options;

  const optionsMfe = await prepareConfig(defaultOptionsMfe, options, context);

  if (!optionsMfe.deployUrl) {
    throw new Error(
      'Deploy url is not defined. It is necessary for MFE. You should "deployUrl" options or set "deployUrlEnvName" in your config'
    );
  }

  const mapShareObject = getMapName(
    optionsMfe.shared,
    optionsMfe.sharedMappings
  );

  defaultOptions.externalDependencies = [...mapShareObject.values()].map(
    (i) => i.packageName
  );

  const esPluginPromise = optionsMfe.esPlugins.map((item) =>
    loadModule<Plugin>(item, options.tsConfig, context.logger)
  );

  const esPlugins = await Promise.all(esPluginPromise);
  const mainTransform = await indexHtml(optionsMfe);

  const resultEsBuild = [
    ...esPlugins,
    entryPointForExtendDependencies(optionsMfe),
    importMapConfigPlugin(optionsMfe),
    serverSSRPlugin(optionsMfe.deployUrl),
    moveCustomLoaderPlugin(),
    changePathForAngularSsrNode(),
  ];
  // @ts-expect-error it private var
  defaultOptions.partialSSRBuild = true;

  const extensions = {
    codePlugins: resultEsBuild,
    indexHtmlTransformer: async (input) => {
      const mainTransformResult = await mainTransform(input);
      return optionsMfe.indexHtmlTransformer(mainTransformResult);
    },
  };

  yield* buildApplication(defaultOptions as any, context, extensions);
}

export default createBuilder(runBuilder);
