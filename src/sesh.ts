import { exec } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { env } from "./env";
import glob from 'glob';
import mergeWith from 'lodash.merge';

const asyncExec = promisify(exec);

export interface Session {
  Src: string; // tmux or zoxide
  Name: string; // The display name
  Path: string; // The absolute directory path
  Score: number; // The score of the session (from Zoxide)
  Focused: boolean; // If tab is active
  Windows: number; // The number of winaows in the session
  Socket: string;
}

export function getSessions() {
  return new Promise<Session[]>( async (resolve, reject) => {
    const kitty_socket = glob.sync('/tmp/mykitty-*')[0];
    const zoxide = await asyncExec('zoxide query --list --score', { env });
    const zoxide_hash = {};
    zoxide.stdout.split('\n').forEach((line) => {
      if (line.length == 0)
        return;

      const [_, score, path] = line.match(/^\s*([0-9\.]+)\s+(.*)$/)
      const spath = path.replace(homedir(), '~')
      zoxide_hash[spath] = {
        Score: parseFloat(score),
        Src: 'zoxide',
        Windows: 0,
        Name: spath,
        Path: spath,
        Socket: kitty_socket,
        Focused: false
      }
    })

    const kitty_windows = await asyncExec(`kitty @ --to unix:${kitty_socket} ls`, { env });
    const kitty_json = JSON.parse(kitty_windows.stdout);
    const kitty_hash = {};
    kitty_json.forEach(os_element => {
      os_element.tabs.forEach(tab => {
        kitty_hash[tab.title] = {
          Focused: tab.is_focused,
          Score: 0.0,
          Windows: tab.windows.length,
          Src: 'kitty',
          Name: tab.title,
          Path: tab.title,
          Socket: kitty_socket,
          Id: tab.id,
        }
      });
    });

    // All paths and kitty tab titles without repetitions.
    const sessions_obj = mergeWith(zoxide_hash, kitty_hash, (objValue, srcValue) => {
      return {
        Focused: srcValue.Focused,
        Score: objValue.Score,
        Windows: objValue.Windows,
        Src: 'kitty',
        Name: srcValue.Name,
        Path: srcValue.Path,
        Socket: kitty_hash,
        Id: srcValue.Id,
      }
    });
    const sessions = Object.values(sessions_obj).sort((a, b) => a.Src - b.Src);
    
    return resolve(sessions ?? []);
  });
}

export function connectToSession(session: Session): Promise<void> {
  return new Promise<void>( async (resolve, reject) => {
    try {
      const query = session.Id ? `id:${session.Id}` : `title:"^${session.Path}$"`
      await asyncExec(`kitty @ --to unix:${session.Socket} focus-tab --match ${query}`, { env });
    } catch (error) {
      if (!error.message.match(/No matching tabs/)) {
        console.log('focusTab', error);
        return reject(error);
      }
      try {
        await asyncExec(`kitty @ --to unix:${session.Socket} launch --type tab --cwd ${session.Path} --tab-title=${session.Path}`, { env });
      } catch (error) {
        console.log('createTab', error);
        return reject(error);
      };
    }
    resolve();
  });
}

export async function isTmuxRunning(): Promise<boolean> {
  return true;
}
