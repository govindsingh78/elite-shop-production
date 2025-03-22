import React from 'react'

import LatestProducts from './latestProducts'
import FeaturedProducts from './FeaturedProducts'
 
import Hero from './Hero'
import Layout from './Layout'


const Home = () => {
  return (
   <>
    
        <Layout>
            <Hero/>
            <LatestProducts/>
            <FeaturedProducts/>
        </Layout>

   </>
  )
}

export default Home


