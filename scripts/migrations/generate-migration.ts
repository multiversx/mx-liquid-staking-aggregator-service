import { exec } from 'child_process';

const command = `yarn typeormcli:config migration:generate ./libs/timescaledb/src/migrations/${process.argv[2]}`;

(() => exec(command, (error, stdout, stderr) => {
  if (error !== null) {
    console.error(stderr);
  }
  console.info(stdout);
}))();
