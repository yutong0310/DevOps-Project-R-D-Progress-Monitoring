"use client";
// import react, { useState, useEffect } from 'react';

function Login(props : any) {

    return (
        <div className="relative left-[30%] top-[30%] h-[40%] w-[40%] bg-[#312C2C] bg-opacity-70 rounded-xl">
            <div className="relative left-0 top-0 h-[10%] w-full flex flex-row justify-center items-center text-xl text-blue-500 font-semibold font-sans">
                Login
            </div>
            <div className="relative left-[10%] top-0 h-[90%] w-[80%] flex flex-col justify-center items-center">
                <div className="flex flex-col h-[35%] w-[80%]">
                    <div className="indent-[10px] w-full h-[30%] text-lg font-semibold font-sans">
                        Username
                    </div>
                    <div className="flex flex-row w-full h-[30%] rounded-xl justify-left ">
                        <input 
                            type="text" 
                            value={props.username}
                            onChange={async (e) => {
                                props.setUsername(e.target.value)
                                console.log("username = " + props.username)    
                            }}
                            className="outline-none appearance-none border-2 border-blue-500 bg-transparent focus:ring-0 rounded-md indent-[10px] overflow-auto w-full h-full"  
                        />
                    </div>
                </div>
                <div className="flex flex-col h-[35%] w-[80%]">
                    <div className="indent-[10px] w-full h-[30%] text-lg font-semibold font-sans">
                        Password
                    </div>
                    <div className="flex flex-row w-full h-[30%] rounded-xl justify-left">
                        <input 
                            type="password" 
                            value={props.password}
                            onChange={async (e) => {
                                props.setPassword(e.target.value)
                                console.log("password = " + props.password)    
                            }}
                            className="indent-[10px] outline-none bg-transparent appearance-none border-2 border-blue-500 focus:ring-0 rounded-md overflow-auto w-full h-full"></input>
                    </div>
                </div>
                <div className="flex flex-row h-[10%] w-[30%] justify-center items-center text-md bg-blue-500 rounded-md font-semibold hover:cursor-pointer" onClick={() => {props.handleLogin(props.username, props.password)}}>
                    Login
                </div>
            </div>
        </div>
    );
}


export default Login;
