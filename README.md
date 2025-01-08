# @klerick/nx-angular-mf

- [Readme about lib](./libs/nx-angular-mf/README.md)


## Local Development


You can test directly the libraries by using the playground application:

1. Build builder:
   ```shell
   nx build nx-angular-mf
   ```
2. Start the `first remote` application:
   ```shell
   npx nx run mf1-application:serve
   ```
3. Start the `remote` application:
   ```shell
   npx nx run host-application:serve
   ```
