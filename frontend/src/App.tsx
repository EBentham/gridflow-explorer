import { Navigate, Route, Routes } from 'react-router-dom'
import { NotFoundScreen } from './screens/NotFoundScreen'
import { CatalogueScreen } from './screens/catalogue/CatalogueScreen'
import { SourceScreen } from './screens/catalogue/SourceScreen'
import { ForecastScreen } from './screens/forecasts/ForecastScreen'
import { GenerationMixScreen } from './screens/generation-mix/GenerationMixScreen'
import { SystemPricesScreen } from './screens/system-prices/SystemPricesScreen'
import { WindForecastScreen } from './screens/wind-forecast/WindForecastScreen'
import { Shell } from './shell/Shell'

/**
 * Every screen sits in the shell. The brand, and `/`, open the catalogue;
 * the pinned screens keep their routes; /forecasts is reached from the
 * catalogue, not the rail.
 */
function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/sources" replace />} />
        <Route path="sources" element={<CatalogueScreen />} />
        <Route path="sources/:sourceKey" element={<SourceScreen />} />
        <Route path="datasets/generation-mix" element={<GenerationMixScreen />} />
        <Route path="datasets/system-prices" element={<SystemPricesScreen />} />
        <Route path="forecasts" element={<ForecastScreen />} />
        <Route path="forecasts/wind" element={<WindForecastScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  )
}

export default App
