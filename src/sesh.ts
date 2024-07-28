import { exec } from "child_process";
import { env } from "./env";

export interface Session {
  Src: string; // tmux or zoxide
  Name: string; // The display name
  Path: string; // The absolute directory path
  Score: number; // The score of the session (from Zoxide)
  Attached: number; // Whether the session is currently attached
  Windows: number; // The number of windows in the session
  Socket: string;
}

export function getSessions() {
  return new Promise<Session[]>((resolve, reject) => {
    exec(`ruby ~/dev/dotfiles/bin/kitty-sesh.rb`, { env }, (error, stdout, stderr) => {
      console.log(error || stderr)
      if (error || stderr) {
        return reject(`Please upgrade to the latest version of the sesh CLI`);
      }
      const sessions = JSON.parse(stdout);
      return resolve(sessions ?? []);
    });
  });
}

export function connectToSession(session: Session): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec(`kitty @ --to unix:${session.Socket} focus-tab --match=env:PWD=^${session.Path}$ || kitty @ --to unix:${session.Socket} launch --type tab --cwd ${session.Path}`, { env }, (error, _, stderr) => {
      if (error || stderr) {
        console.error("error ", error);
        console.error("stderr ", stderr);
      }
      return resolve();
    });
  });
}

export async function isTmuxRunning(): Promise<boolean> {
  return true;
}
