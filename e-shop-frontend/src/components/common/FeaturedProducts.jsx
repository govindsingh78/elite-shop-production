import React from 'react'
import productImg from '../../assets/images/Mens/eleven.jpg'
const FeaturedProducts = () => {
  return (
    <section className='section-02 py-5'>
                <div className='container'>
                    <h2>Featured Products</h2>
                    <div className='row'>
                        <div className='col-md-3'>
                            <div className='product card-border-0'>
                                <div className='card-img'>
                                    <img src={productImg} alt="" className='w-100'/>
                                </div>
                                <div className='card-body pt-3'>
                                   <a href=''>Red Check Shirt for Men</a>
                                   <div className='price'>
    
                                    $50 <span className='text-decoration-line-through'>$80</span>
    
                                   </div>
                                </div>
                            </div>
                        </div>
    
                        <div className='col-md-3'>
                            <div className='product card-border-0'>
                                <div className='card-img'>
                                    <img src={productImg} alt="" className='w-100'/>
                                </div>
                                <div className='card-body pt-3'>
                                   <a href=''>Red Check Shirt for Men</a>
                                   <div className='price'>
    
                                    $50 <span className='text-decoration-line-through'>$80</span>
    
                                   </div>
                                </div>
                            </div>
                        </div>
    
                        <div className='col-md-3'>
                            <div className='product card-border-0'>
                                <div className='card-img'>
                                    <img src={productImg} alt="" className='w-100'/>
                                </div>
                                <div className='card-body pt-3'>
                                   <a href=''>Red Check Shirt for Men</a>
                                   <div className='price'>
    
                                    $50 <span className='text-decoration-line-through'>$80</span>
    
                                   </div>
                                </div>
                            </div>
                        </div>
    
                        <div className='col-md-3'>
                            <div className='product card-border-0'>
                                <div className='card-img'>
                                    <img src={productImg} alt="" className='w-100'/>
                                </div>
                                <div className='card-body pt-3'>
                                   <a href=''>Red Check Shirt for Men</a>
                                   <div className='price'>
    
                                    $50 <span className='text-decoration-line-through'>$80</span>
    
                                   </div>
                                </div>
                            </div>
                        </div>
    
                    </div>
                </div>
            </section>
  )
}

export default FeaturedProducts
