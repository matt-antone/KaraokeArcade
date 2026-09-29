import React from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/es/integration/react'
import store from 'store/store'
import * as Persistor from 'store/Persistor'
import CoreLayout from './CoreLayout/CoreLayout'
import ConnectionScreen from './ConnectionScreen/ConnectionScreen'

// 91 Loading is the boot screen too, not a bare spinner
const boot = <ConnectionScreen variant='loading' />

const App = () => (
  <Provider store={store}>
    <PersistGate loading={boot} persistor={Persistor.get()}>
      <React.Suspense fallback={boot}>
        <CoreLayout />
      </React.Suspense>
    </PersistGate>
  </Provider>
)

export default App
