# tarextension-pi-project-switcher

Persönliche Pi-Extension zum Wechseln des aktiven Projektordners, ohne Pi beenden zu müssen.

## Funktionen

- `/cd <Ordner>` wechselt in einen anderen Projektordner.
- `/cd` zeigt eine Auswahl erkannter Projektordner.
- `/pwd` zeigt das aktuelle Pi-Arbeitsverzeichnis.
- Die bisherige Unterhaltung wird in eine neue Sitzung für den Zielordner übernommen.
- Die ursprüngliche Sitzung bleibt unverändert erhalten.
- Pi lädt für den Zielordner die dort gültigen Einstellungen, Kontextdateien und Ressourcen neu.

## Installation aus GitHub

Diese Extension ist Teil der Sammlung [tarextension](../README.md). Die Installation erfolgt über das zentrale Paket im Repository-Stamm.

```sh
pi install git:github.com/TarJae/tarextension
```

Anschließend in einer laufenden Pi-Sitzung:

```text
/reload
```

## Verwendung

Direkter Wechsel:

```text
/cd C:\Projekte\T2-Rektumkarzinom
```

Bei Pfaden mit Leerzeichen sind Anführungszeichen möglich:

```text
/cd "C:\Projekte\Mein Projekt"
```

Interaktive Auswahl:

```text
/cd
```

Aktuellen Ordner anzeigen:

```text
/pwd
```

Relative Pfade, `~` und Windows-Umgebungsvariablen wie `%USERPROFILE%` werden unterstützt.

## Funktionsweise

Pi bindet Dateitools, Projektressourcen und Sitzungen an ein Arbeitsverzeichnis. Eine Änderung von `process.cwd()` allein wäre deshalb unvollständig und unsicher.

Die Extension erzeugt stattdessen mit `SessionManager.forkFrom()` eine neue Sitzung für den Zielordner und wechselt anschließend über Pis offizielle Session-API dorthin. Dadurch werden auch Footer, Dateitools, Projektkontext und Ressourcen korrekt aktualisiert.

## Sicherheit und Datenschutz

- Die Extension führt keine Netzwerkzugriffe aus.
- Sie verändert keine Projektdateien.
- Sitzungsdateien werden weiterhin im konfigurierten Pi-Sitzungsverzeichnis gespeichert.
- Beim Wechsel wird der aktuelle Gesprächsverlauf in die neue Sitzung übernommen. Er wird nicht in den Zielprojektordner geschrieben.
- Extensions laufen mit denselben Betriebssystemrechten wie Pi. Quellcode vor der Installation prüfen.

## Voraussetzungen

- Pi mit Extension- und Session-Replacement-API
- Node.js 22.6 oder neuer
- getestet für Pi 1.4.0 unter Windows

## Entwicklung und Tests

```sh
npm test
```

Die folgenden Befehle werden in diesem Unterordner ausgeführt. Im Repository-Stamm führt `npm test` zusätzlich die Paketstruktur-Tests aus.

Ladetest mit einem temporären Pi-Profil:

```sh
PI_CODING_AGENT_DIR=/tmp/pi-project-switcher-test pi -e . --help
```
