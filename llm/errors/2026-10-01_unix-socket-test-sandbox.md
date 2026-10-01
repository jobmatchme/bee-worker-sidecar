# UNIX-Socket-Test im Sandbox-Lauf blockiert

## Was passiert ist

Der erste Lauf von `npm run check` scheiterte beim Integrationstest, weil die
Sandbox das Anlegen eines lokalen UNIX-Sockets mit `EPERM` verhindert hat.

## Auswirkung

Der Fehler sah zunächst wie ein Testfehler aus, betraf aber weder Produktcode
noch Testlogik. Es wurden keine Daten verändert oder verloren.

## Korrektur

Der identische Check wurde mit der bereits vorgesehenen, eng begrenzten
Ausführung außerhalb der Sandbox wiederholt. Alle sechs Tests sowie Linting,
Typprüfung, Coverage und Build liefen erfolgreich durch.

## Vorbeugung

Tests, die lokale UNIX-Sockets öffnen, sollten in dieser Arbeitsumgebung direkt
mit der dafür vorgesehenen Berechtigung ausgeführt werden. Ein `EPERM` beim
Socket-Bind ist zunächst als Umgebungsbeschränkung und nicht als fachlicher
Fehler zu prüfen.
