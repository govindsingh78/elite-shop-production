import React from 'react'
import Layout from '../common/Layout'
import { useForm } from "react-hook-form";
import { apiUrl } from '../common/http';

const Login = () => {

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const onSubmit = async (data) => {
    
    const res =  await fetch(`http://127.0.0.1:8000/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-type' : 'application/json'
      },
      body: JSON.stringify(data)
    }).then(res => res.json()).then(result => {
      console.log(result)
    });
  
    }
  
  return (
   <Layout>
    <div className='container d-flex justify-content-center my-5 p-5'>
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className='card shadow border-0 login p-4'>
        <h3><strong>Admin Login</strong></h3>
        <div className='mb-3'>
          <label htmlFor='' className='form-label'>Email</label>
          <input 
          {
            ...register('email',{
                required: "The email field is required",
                pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                } 
            })
          }
 type='text' className={`form-control ${errors.email && 'is-invalid'}`} placeholder='Email'/>
          {errors.email && <span className='invalid-feedback'>{errors.email?.message}</span>}

          {/* <p className='invalid-feedback'>{errors.email?.message}</p> */}
        </div>
        <div className='mb-3'>
          <label htmlFor='' className='form-label'>Password</label>
          <input {...register("password", { required: true })} type='password' className={`form-control ${errors.password && 'is-invalid'}`} placeholder='Password'/>
          {errors.password && <span className='invalid-feedback'>Password field is required</span>}
        </div>

        <button className='btn btn-secondary'>Login</button>
      </div>
      </form>
    </div>

   </Layout>
  )
}

export default Login
