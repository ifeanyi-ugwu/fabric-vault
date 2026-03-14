import { defineConfig } from "vitepress"

export default defineConfig({
  base: "/fabric-vault/",
  title: "Fabric Vault",
  description: "Secure browser wallet for Hyperledger Fabric",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Examples", link: "/guide/examples" },
      { text: "Privacy Policy", link: "/privacy-policy" },
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
          { text: "Demo Setup", link: "/guide/demo-setup" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/ifeanyi-ugwu/fabric-vault",
      },
    ],
  },
})
