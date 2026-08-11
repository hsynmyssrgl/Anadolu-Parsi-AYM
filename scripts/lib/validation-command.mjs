const WINDOWS_COMMAND_ALIASES = new Map([
  ['powershell', 'powershell.exe'],
  ['pwsh', 'pwsh.exe']
]);

const normalizeArgs = (args) => {
  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
    throw new TypeError('Validation command arguments must be an array of strings.');
  }
  return [...args];
};

export const resolveValidationCommand = ({
  command,
  args = [],
  platform = process.platform,
  env = process.env,
  nodeExecutable = process.execPath
}) => {
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new TypeError('Validation command must be a non-empty string.');
  }
  const normalizedCommand = command.trim();
  const normalizedArgs = normalizeArgs(args);

  if (normalizedCommand === 'node') {
    return {
      requestedCommand: normalizedCommand,
      requestedArgs: normalizedArgs,
      command: nodeExecutable,
      args: normalizedArgs,
      strategy: 'node-executable'
    };
  }

  if (normalizedCommand === 'npm') {
    const npmExecPath = typeof env.npm_execpath === 'string' ? env.npm_execpath.trim() : '';
    if (npmExecPath.length > 0) {
      return {
        requestedCommand: normalizedCommand,
        requestedArgs: normalizedArgs,
        command: nodeExecutable,
        args: [npmExecPath, ...normalizedArgs],
        strategy: 'npm-execpath'
      };
    }
    if (platform === 'win32') {
      const commandInterpreter = typeof env.ComSpec === 'string' && env.ComSpec.trim().length > 0
        ? env.ComSpec.trim()
        : 'cmd.exe';
      return {
        requestedCommand: normalizedCommand,
        requestedArgs: normalizedArgs,
        command: commandInterpreter,
        args: ['/d', '/s', '/c', 'npm', ...normalizedArgs],
        strategy: 'windows-command-interpreter'
      };
    }
    return {
      requestedCommand: normalizedCommand,
      requestedArgs: normalizedArgs,
      command: 'npm',
      args: normalizedArgs,
      strategy: 'path-command'
    };
  }

  const platformCommand = platform === 'win32'
    ? WINDOWS_COMMAND_ALIASES.get(normalizedCommand) ?? normalizedCommand
    : normalizedCommand;
  return {
    requestedCommand: normalizedCommand,
    requestedArgs: normalizedArgs,
    command: platformCommand,
    args: normalizedArgs,
    strategy: platformCommand === normalizedCommand ? 'path-command' : 'windows-executable-alias'
  };
};
