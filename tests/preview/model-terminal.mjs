/** The subscription route keeps uncertain spending liability when a CLI frame is
 * unusable. For the preview reply, a completed model subprocess still proves
 * that this invocation has no usable answer; a timeout or interrupted process does not. */
export const observeTerminalModelCommand = (io, onTerminal) => ({ ...io,
  execute: async command => {
    const result = await io.execute(command);
    if (command.args.includes('--print') && result.limited === false
      && Number.isSafeInteger(result.code) && result.code >= 0) onTerminal();
    return result;
  } });
