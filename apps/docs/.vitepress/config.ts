import { defineConfig } from "vitepress"

export default defineConfig({
  title: "Fabric Vault",
  description: "Secure browser wallet for Hyperledger Fabric",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Examples", link: "/guide/examples" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/" },
          { text: "Provider Discovery", link: "/guide/discovery" },
          { text: "Transactions", link: "/guide/transactions" },
          { text: "Subscriptions", link: "/guide/subscriptions" },
          { text: "Examples", link: "/guide/examples" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/ifeanyiugwu/fabric-vault",
      },
    ],
  },
})
