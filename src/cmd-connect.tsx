import { useState, useEffect } from "react";

import {
  Icon,
  List,
  Action,
  ActionPanel,
  closeMainWindow,
  clearSearchBar,
  showToast,
  Toast,
  Color,
} from "@raycast/api";
import { getSessions, connectToSession, isTmuxRunning, Session } from "./sesh";
import { openApp } from "./app";

function getIcon(session: Session) {
  switch (session.Src) {
    case "kitty":
      return {
        source: Icon.Bolt,
        tintColor: session.Focused >= 1 ? Color.Blue : Color.Green,
        tooltip: session.Focused >= 1 ? "Focused" : "Not Focused",
      };
    case "zoxide":
    default:
      return {
        source: Icon.Folder,
        tintColor: Color.SecondaryText,
      };
  }
}

function formatScore(score: number) {
  if (score === 0) return undefined;
  return String(Number.isInteger(score) ? score : score.toFixed(2));
}

export default function ConnectCommand() {
  const [sessions, setSessions] = useState<{
    kitty: Array<Session>;
    zoxide: Array<Session>;
  }>({ kitty: [], zoxide: [] });
  const [isLoading, setIsLoading] = useState(true);

  async function getAndSetSessions() {
    try {
      const sessions = await getSessions();
      setSessions({
        kitty: sessions.filter((s) => s.Src === "kitty"),
        zoxide: sessions.filter((s) => s.Src === "zoxide"),
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't get sessions",
        message: typeof error === "string" ? error : "Unknown reason",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!(await isTmuxRunning())) {
        await showToast({
          style: Toast.Style.Failure,
          title: "tmux isn't running",
          message: "Please start tmux before using this command.",
        });
        setIsLoading(false);
        return;
      }
      await getAndSetSessions();
    })();
  }, []);

  async function connect(session: Session) {
    try {
      setIsLoading(true);
      await connectToSession(session);
      await openApp();
      await closeMainWindow();
      await clearSearchBar();
      await getAndSetSessions();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't connect to session",
        message: typeof error === "string" ? error : "Unknown reason",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <List isLoading={isLoading}>
      <List.Section title="kitty">
        {sessions.kitty.map((session, index) => (
          <List.Item
            key={index}
            title={session.Name}
            icon={getIcon(session)}
            accessories={[
              {
                icon: Icon.AppWindow,
                text: String(session.Windows),
                tooltip: session.Windows === 1 ? "Window" : "Windows",
              },
            ]}
            actions={
              <ActionPanel>
                <Action title="Connect to Session" onAction={() => connect(session)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="zoxide">
        {sessions.zoxide.map((session, index) => (
          <List.Item
            key={index}
            title={session.Name}
            icon={getIcon(session)}
            accessories={[{ text: formatScore(session.Score), icon: Icon.Racket, tooltip: "Score" }]}
            actions={
              <ActionPanel>
                <Action title="Connect to Session" onAction={() => connect(session)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
