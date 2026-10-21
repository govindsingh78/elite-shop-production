import React from 'react'
import Header from './Header'
import Footer from './Footer'

// Storefront categories come from StorefrontCategoriesProvider in App.jsx, so pages can read them too.
const Layout = ({children}) => {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>

  )
}

export default Layout
