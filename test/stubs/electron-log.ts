/** No-op logger standing in for `electron-log/main` during unit tests. */
const noop = (): void => {};

const log = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  verbose: noop,
  initialize: noop,
  transports: { file: { level: "info" as const } },
};

export default log;
