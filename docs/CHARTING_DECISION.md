# Decyzja o wykresach

## Pytanie

Czy dla Investora lepsze beda D3.js, Chart.js, czy inna biblioteka?

## Rekomendacja

Na start:

- **Chart.js** jako domyslna biblioteka dla dashboardow i standardowych wykresow.
- **D3.js** jako narzedzie specjalne dla nietypowych wizualizacji, nie jako podstawowa biblioteka wykresow.
- Nie zamykac drogi do **Apache ECharts** albo **TradingView Lightweight Charts**, jesli pojawia sie wymagania typu bardzo duze serie, zaawansowany zoom, adnotacje lub financial charting.

## Chart.js

Najlepiej pasuje do:

- wartosci portfela w czasie,
- alokacji aktywow,
- struktury walut,
- udzialu kont/portfeli,
- prostych benchmarkow,
- dochodow i obciazen miesiecznych,
- dashboardowych kart z wykresami.

Zalety:

- szybki start,
- Canvas zamiast SVG, wiec sensowna wydajnosc dla wiekszych serii,
- ma decimation plugin dla duzych line chartow,
- popularny i dobrze opisany,
- latwy do opakowania w React components,
- wystarczy dla wiekszosci wykresow produktowych Investora.

Ryzyka:

- mniej elastyczny niz D3,
- customowe interakcje i nietypowe layouty bywaja trudniejsze,
- financial candlestick/volume/profile wymaga pluginow albo innej biblioteki.

## D3.js

Najlepiej pasuje do:

- niestandardowych wizualizacji,
- wlasnych skal i osi,
- eksperymentalnych raportow,
- waterfall/flow/sankey,
- heatmap alokacji,
- bardzo dopracowanych interakcji i animacji,
- wizualizacji, ktore nie sa typowym line/bar/pie chartem.

Zalety:

- maksymalna kontrola,
- swietny zestaw modulow: scales, shapes, time, array, format,
- nadaje sie jako fundament pod wlasne chart primitives.

Ryzyka:

- wiecej kodu utrzymaniowego,
- integracja z React wymaga dyscypliny,
- SVG moze byc waskim gardlem przy bardzo duzej liczbie punktow, chyba ze uzyjemy D3 tylko do skal i Canvas/WebGL do renderu,
- zbyt duzy koszt na standardowy dashboard.

## Apache ECharts

Mocny kandydat, jesli chcemy:

- duzo gotowych typow wykresow,
- rozbudowany tooltip/legend/zoom,
- wieksze serie danych,
- mniej wlasnego kodu niz w D3,
- bardziej analityczne dashboardy.

Minus:

- ciezsza biblioteka,
- bardziej wlasny ekosystem konfiguracji,
- UI moze szybciej zaczac wygladac jak panel BI, jesli nie dopilnujemy designu.

## TradingView Lightweight Charts

Najlepiej pasuje do:

- cen instrumentow,
- time-series finansowych,
- wykresow liniowych, area i candlestick,
- zoom/pan w stylu aplikacji inwestycyjnych.

Nie zastapi calego dashboardu, ale moze byc najlepszym wyborem dla szczegolow instrumentu.

## Decyzja praktyczna

Pierwszy etap:

```text
Chart.js
  dashboard value over time
  allocation donut/bar
  income/expense monthly bars
  benchmark line

D3.js
  shared formatting/scales helpers only when useful
  custom visualizations later

TradingView Lightweight Charts
  instrument detail price chart, if potrzebujemy financial UX
```

Kryterium zmiany decyzji:

- Jesli Chart.js zacznie wymagac wielu obejsc dla interakcji, przejsc na ECharts dla dashboardow.
- Jesli potrzebujemy precyzyjnego financial chartingu, dodac Lightweight Charts dla ekranu instrumentu.
- Jesli budujemy unikalny raport, uzyc D3 lokalnie dla tego jednego komponentu.

## Zrodla

- Chart.js performance docs: https://www.chartjs.org/docs/latest/general/performance.html
- Chart.js decimation docs: https://www.chartjs.org/docs/latest/configuration/decimation.html
- D3 official site: https://d3js.org/
- daisyUI docs: https://daisyui.com/docs/intro/
- Apache ECharts: https://echarts.apache.org/
- TradingView Lightweight Charts: https://www.tradingview.com/lightweight-charts/
