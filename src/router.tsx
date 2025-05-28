import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from "@tanstack/react-router"

import { Lock } from "./components/lock"
import { AddIdentity } from "./pages/add-identity"
import CreateWallet from "./pages/create-wallet"
import Dashboard from "./pages/dashboard"
import { Home } from "./pages/home"
import UnlockWallet from "./pages/unlock-wallet"

import "./global.css"

import { ErrorView } from "./components/error"
import { Layout } from "./layout"
import { ChangePassword } from "./pages/change-password"
import { HandleRequest } from "./pages/handle-request"

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
  errorComponent: ({ error }) => <ErrorView error={error} />
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home
})

const createWalletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create-wallet",
  component: CreateWallet
})

const unlockWalletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unlock-wallet",
  component: UnlockWallet
})

const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/change-password",
  component: ChangePassword
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Dashboard
})

const addIdentityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/add-identity",
  component: AddIdentity
})

const lockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lock",
  component: Lock
})

const handleRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/handle-request/$type",
  component: HandleRequest
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  createWalletRoute,
  unlockWalletRoute,
  changePasswordRoute,
  dashboardRoute,
  addIdentityRoute,
  lockRoute,
  handleRequestRoute
])

declare module "@tanstack/react-router" {
  interface Register {
    // This infers the type of our router and registers it across your entire project
    router: typeof router
  }
}

// Create the router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  history: createHashHistory()
})

function Router() {
  return <RouterProvider router={router} />
}

export default Router
