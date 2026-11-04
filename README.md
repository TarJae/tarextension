# tarextension

Persönliche Sammlung von Pi-Extensions von TarJae. Jede Extension liegt in einem eigenen Unterordner; das zentrale `package.json` macht die Sammlung als Pi-Paket installierbar.

## Enthaltene Extensions

| Extension | Funktionen |
| --- | --- |
| [tarextension-pi-project-switcher](./tarextension-pi-project-switcher/) | Mit `/tarextension-pi-project-switcher` (kurz `/cd`) den Projektordner wechseln und die Unterhaltung mitnehmen; mit `/pwd` den aktuellen Ordner anzeigen. |
| [tarextension-pi-start-menu](./tarextension-pi-start-menu/) | Automatisches Startmenü und `/tarextension-pi-start-menu` (kurz `/start-menu`) mit Checkboxen für Skills, Extensions und Tools; Auswahl speichern und Ressourcen neu laden. |

Mit `/tarextension-` in Pis Befehlseingabe zeigt die Autovervollständigung beide vollständigen Extension-Befehle. Die bisherigen Kurzbefehle bleiben erhalten.

## Installation

```sh
pi install git:github.com/TarJae/tarextension
```

Anschließend Pi neu starten oder `/reload` ausführen.

### Bestehende Installation umstellen

Dieses Repository hieß zuvor `tarextension-pi-project-switcher`. Die Git-Historie bleibt erhalten. GitHub leitet die alte Repository-URL weiter; für neue Installationen die neue URL verwenden.

Falls die Extension bereits über die alte URL installiert ist, den bisherigen Paketeintrag ersetzen, damit sie nicht doppelt geladen wird:

```sh
pi remove git:github.com/TarJae/tarextension-pi-project-switcher
pi install git:github.com/TarJae/tarextension
```

Bei einer projektlokalen Installation beide Befehle mit `--local` ausführen. Wurde ursprünglich eine andere Quellen-Schreibweise verwendet, zuerst mit `pi list` den bisherigen Eintrag prüfen und diesen entfernen.

## Struktur

```text
tarextension/
├── package.json
├── README.md
├── tests/
├── tarextension-pi-project-switcher/
│   ├── package.json
│   ├── README.md
│   ├── extensions/
│   ├── lib/
│   └── tests/
└── tarextension-pi-start-menu/
    ├── package.json
    ├── README.md
    ├── extensions/
    ├── lib/
    └── tests/
```

## Weitere Extensions hinzufügen

1. Einen weiteren Unterordner anlegen, beispielsweise `tarextension-meine-extension/`.
2. Den Einstiegspunkt der Extension im zentralen `package.json` unter `pi.extensions` ergänzen. Pfade sind relativ zum Repository-Stamm.
3. Falls erforderlich, Laufzeitabhängigkeiten im zentralen `package.json` deklarieren und den Testbefehl erweitern.
4. Die Extension in der Tabelle oben dokumentieren.

## Entwicklung und Tests

Im Repository-Stamm:

```sh
npm test
```

Der Testlauf prüft die Paketpfade und führt die Tests beider Extensions aus. Jede Extension lässt sich außerdem separat aus ihrem Unterordner mit `npm test` testen. Für echte Pi-Integrationstests siehe [Startmenü-Dokumentation](./tarextension-pi-start-menu/).

Ladetest mit einem temporären Pi-Profil (POSIX-Shell):

```sh
PI_CODING_AGENT_DIR=/tmp/tarextension-test pi --offline --no-extensions -e . --help
```

## Sicherheit

Extensions laufen mit denselben Betriebssystemrechten wie Pi. Vor der Installation den Quellcode prüfen. Der Project-Switcher greift nicht auf das Netzwerk zu und verändert keine Projektdateien; beim Projektwechsel wird die Unterhaltung in eine neue Pi-Sitzung übernommen.

Das Startmenü verändert auf ausdrückliches Speichern Pi-Ressourcenfilter sowie eine profilweite Tool-Auswahl. Tools werden sofort umgeschaltet; Skills/Extensions benötigen einen Reload. Bereits ausgeführter Extension-Code lässt sich nicht rückgängig machen. Details zu Geltungsbereich, CLI-Ausnahmen und Datenschutz stehen in der [Startmenü-Dokumentation](./tarextension-pi-start-menu/).
