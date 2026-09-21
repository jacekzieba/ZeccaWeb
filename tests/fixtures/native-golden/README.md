# Fixtury złote z aplikacji natywnej

Kopie plików z repo Zecca (`Tests/Fixtures/TransactionScenarios/` i
`Tests/Fixtures/ValuationScenarios/`). Natywne testy sprawdzają je w silnikach Swift,
a `tests/unit/native-golden-parity.test.ts` — w silniku webowym. **Te same oczekiwane
liczby na obu platformach** to jedyny sędzia dla XIRR, TWR, CAGR, zrealizowanego P/L
i wartości portfela, bo każda platforma liczy je własnym kodem.

Nie edytuj tych plików tutaj: zmień je w repo natywnym i skopiuj ponownie
(`node scripts/sync-native-golden.mjs`, opcja `--check` sprawdza zgodność bez kopiowania).
Rozjazd wyniku weba z fixturą jest błędem parytetu do zgłoszenia — nie liczbą do „poprawienia”
w oczekiwaniach.
