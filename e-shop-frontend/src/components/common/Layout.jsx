import React from 'react'
import Header from './Header'
import Footer from './Footer'
import { StorefrontCategoriesProvider } from './useStorefrontCategories'

const Layout = ({children}) => {
  return (
    <StorefrontCategoriesProvider>
      <Header />
      {children}
      <Footer />
    </StorefrontCategoriesProvider>

  )
}

export default Layout
