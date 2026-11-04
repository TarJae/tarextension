# tarextension-pi-start-menu

Pi-Startmenü mit Checkboxen für **Skills**, **Extensions** und **Tools**. Getestet mit Pi 1.4.0 und Node 24; benötigt die aktuellen `@earendil-works`-Pi-APIs.

## Installation

Als Teil der Sammlung:

```sh
pi install git:github.com/TarJae/tarextension
```

Bei bereits installierter Sammlung: `pi update --extensions`, anschließend Pi neu starten oder `/reload` ausführen.

Nur diese Extension aus einem lokalen Checkout installieren:

```sh
pi install ./tarextension-pi-start-menu
```

Nicht gleichzeitig beide Varianten installieren. Zum einmaligen Ausprobieren:

```sh
pi -e ./tarextension-pi-start-menu/extensions/start-menu.ts
```

## Bedienung

Das Menü öffnet sich beim ersten interaktiven Sitzungsstart pro Projekt und Pi-Prozess. Später mit **`/start-menu`** erneut öffnen.

| Taste | Aktion |
| --- | --- |
| Tab / Shift+Tab | Skills, Extensions, Tools wechseln |
| ↑ / ↓, Bild↑ / Bild↓ | Einträge durchgehen |
| Leertaste | Checkbox umschalten |
| a / n | Alle / keine im aktuellen Bereich auswählen |
| s | Automatisches Öffnen beim Pi-Start umschalten |
| Enter | Auswahl speichern und weiterarbeiten |
| Esc / Ctrl+C | Entwurf verwerfen; nichts speichern |

Die Extension schützt ihren eigenen Einstiegspunkt vor versehentlichem Abwählen. Quellen und Geltungsbereich stehen neben den Namen; der vollständige Pfad des markierten Eintrags steht darunter. Es gibt keine Mausbedienung.

## Was wird wann wirksam?

- **Tools:** Die Modell-Auswahl wird sofort über `pi.setActiveTools()` geändert und vor der nächsten Aufgabe wiederhergestellt. Später registrierte Tools werden anhand vorhandener gespeicherter Entscheidungen berücksichtigt. Neue Tools ohne Entscheidung behalten ihren Pi-Standardzustand.
- **Skills/Extensions:** Änderungen werden in die regulären Pi-Ressourcenfilter geschrieben. Bei `/start-menu` bietet die Extension danach einen Reload an. Im automatisch geöffneten Startmenü muss anschließend **`/reload`** ausgeführt oder Pi neu gestartet werden: Pi erlaubt Reload nur aus einem Benutzerkommando, nicht aus `session_start`.
- Das ist ein Menü **nach dem Laden von Pi**, kein vorgeschalteter Prozess-Launcher. Bereits geladene Extensions haben ihren Initialisierungscode schon ausgeführt. Abwählen kann das nicht rückgängig machen.
- CLI-Ausnahmen wie `-e`, `--no-extensions`, `--no-skills` oder SDK-Ressourcen sind nicht vollständig über die Einstellungen steuerbar und können Vorrang haben. Einträge zeigen konfigurierte Ressourcen, nicht garantiert den tatsächlichen CLI-Ladezustand.
- Keine Sicherheits-Sandbox: Tools mit `codemode`-/`deferred`-Exposition können trotz fehlender Modell-Deklaration über andere Tools erreichbar sein. Rechtebegrenzung benötigt eine separate Sicherheitslösung.

## Einstellungen und Datenschutz

- Vorhandene Pi-Einstellungen, Paketquellen, Filter und andere Felder bleiben erhalten. Es werden nur geänderte Ressourcenfilter geschrieben, mit Pi-eigener Sperr-/Merge-Logik.
- User-Ressourcen werden im aktiven Pi-Profil, Projektressourcen in dessen `.pi/settings.json` umgeschaltet. Änderungen an User-Ressourcen gelten für alle Projekte dieses Profils. Projektressourcen werden nur bei bestehendem Projektvertrauen berücksichtigt. Das Menü erteilt selbst kein Vertrauen.
- Tool-Auswahl und Autostart-Schalter liegen unter `<agent-dir>/start-menu.json` (`PI_CODING_AGENT_DIR` wird respektiert). Diese Tool-Präferenzen gelten profilweit und können Pi-/CLI-Toolvorgaben übersteuern. Explizit ausgewählte, aber vorübergehend fehlende Tools bleiben für spätere Sitzungen gespeichert.
- Ungültige Startmenü-Konfiguration wird gemeldet und nicht überschrieben. Zur Rückkehr zu den Tool-Standardwerten Pi schließen und `start-menu.json` außerhalb von Pi umbenennen. Ressourcenfilter bleiben davon unabhängig; sie lassen sich mit `pi config` zurücksetzen.
- Ressourcen werden über Pi-Paketdiscovery gefunden, ohne Extension-Factories erneut auszuführen und ohne fehlende Pakete zu installieren. Pi kann dabei lokale Paketmanager-Metadaten abfragen.
- Die Extension sendet keine Daten an Netzwerkdienste. Sie schreibt keine Sitzungsinhalte, Prompts oder Secrets in ihre Konfiguration.
- JSON-/Print-/RPC-Modi öffnen kein Terminalmenü; gespeicherte Tool-Präferenzen werden trotzdem berücksichtigt.

## Tests

```sh
npm test
```

Im Sammlungsstamm werden außerdem die vorhandenen Project-Switcher-Tests ausgeführt. Optionale Integrationstests mit dem echten Pi-Loader und temporären, ausschließlich synthetischen Profilen:

```sh
PI_TEST_AGENT_ROOT=/path/to/node_modules/@earendil-works/pi-coding-agent npm test
```

Ohne diese Variable werden ausschließlich die Pi-Integrationstests übersprungen. Sie greifen nie auf das persönliche Pi-Profil zu.
