import react, {useState, useEffect, useRef} from "react"

const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER;

export default function Users(props: any) {


    const [users, setUsers]: any[] = useState([]) 
    const [userData, setUserData]: any[] = useState([])
    const [clickedDropdown, setClickDropdown] = useState(false)
    const [userToChange, setUserToChange] = useState(null)
    const prevUserChanged = useRef(null)
    const [assignTeam, setAssignTeam] = useState(false)
    const [assignRole, setAssignRole] = useState(false)

    const setUsersAsync = async (users: any) => {
        setUsers(users)
    }
    
    const setUserDataAsync = async (userData: any) => {
        setUserData(userData)
    }

    const setUserToChangeAsync = async (userData: any) => {
        setUserToChange(userData)
    }

    const setClickDropdownAsync = async () => {
        setClickDropdown(!clickedDropdown)
    }
    
    const setClickDropdownAsync2 = async (val: boolean) => {
        setClickDropdown(val)
    }

    const setAssignTeamAsync = async (val: boolean) => {
        setAssignTeam(val)
    }
    
    const setAssignRoleAsync = async (val: boolean) => {
        setAssignRole(val)
    }


    useEffect(() => {
        console.log("users changed")
        if(props.users.length !== 0) {
            console.log("changing users state = "+ JSON.stringify(props.users))
            setUsersAsync(props.users)
        }
    }, [props.users])

    useEffect(() => {
        if (users.length !== 0) {
            console.log("changing user data = " + JSON.stringify(users))
            gettingAllUserData();
        }
    }, [users]); // Run when `users` changes

    async function gettingAllUserData() {
        // set the data to empty before fetching again
        setUserDataAsync([]) 
        for (let user of users) { // Remove `: any`
            try {
                console.log("user id = " + user.id)
                let response = await fetch(`${authServer}/getUserData?userId=${encodeURIComponent(user.id)}`, {
                    method: 'GET',
                    headers: { 
                        "Authorization": `Bearer ${props.token}`,
                        "Content-Type": "application/json"
                    }, 
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch user data: ${response.status}`);
                }
                
                let user_data = await response.json(); // Parse JSON

                console.log("response user = " + JSON.stringify(user_data))
                
                setUserDataAsync((prevUserData: any) => [...prevUserData, user_data]);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        }
    }

    return (
        <div className="absolute top-[2%] left-[19%] w-[79%] h-[96%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70 overflow-y-scroll">
            {userToChange !== prevUserChanged && assignTeam && <div className="relative overflow-y-auto inset-0 flex items-center justify-center z-10">
                    <AssignTeam token={props.token} userToChange={userToChange} setClickDropdownAsync={setClickDropdownAsync} setClickDropdownAsync2={setClickDropdownAsync2} 
                        clickedDropdown={clickedDropdown} setAssignTeam={setAssignTeam} gettingAllUserData={gettingAllUserData}/>
                </div>}
            {userToChange !== prevUserChanged && assignRole && <div className="absolute inset-0 flex items-center justify-center z-10">
                    <AssignRole userToChange={userToChange} setClickDropdownAsync={setClickDropdownAsync} setClickDropdownAsync2={setClickDropdownAsync2}
                        token={props.token} clickedDropdown={clickedDropdown} setAssignRole={setAssignRole} gettingAllUserData={gettingAllUserData}/>
                </div>}
            {userData.length > 0 && 
                <div className={`${(assignTeam || assignRole) ? 'backdrop-blur-sm' : 'backdrop-blur-none'} relative w-full h-full`}>
                    <div className="left-[2%] top-[5%] w-[96%] h-auto flex flex-col gap-4">
                        <div className="flex top-[5%] left-0 indent-[10px] h-auto w-full text-slate-400 text-2xl font-semibold text-start">Project members</div>

                        <div className="flex top-[5%] left-0 indent-[20px] h-auto w-auto text-slate-400 text-xl font-semibold text-start border-b-4 border-slate-400">CIO(s)</div>
                        <div className="h-auto left-[20px] w-[calc(100%-20px)] grid grid-cols-3 gap-x-2 gap-y-2">
                            {
                                userData.map((elem: any, idx: number) => {
                                    // if(userData.r)
                                    let user_cio = false
                                    if(elem.roles){
                                        for(let role of elem.roles){
                                            if(role.name.includes("CIO")) user_cio = true
                                        }
                                    }
                                    if(!user_cio) return null;
                                    return <UserData rolesCurrUser={props.rolesCurrUser} elem={elem} token={props.token} userToChange={userToChange} setUserToChangeAsync={setUserToChangeAsync} prevUserChanged={prevUserChanged}
                                        setAssignTeamAsync={setAssignTeamAsync} setAssignRoleAsync={setAssignRoleAsync} gettingAllUserData={gettingAllUserData}></UserData>
                                })
                            }
                        </div>
                        <div className="flex top-[2%] left-0 indent-[20px] h-auto w-auto text-slate-400 text-xl font-semibold text-start border-b-4 border-slate-400">PO(s)</div>
                        <div className="h-auto left-[20px] w-[calc(100%-20px)] grid grid-cols-3 gap-x-2 gap-y-2">
                            {
                                userData.map((elem: any, idx: number) => {
                                    // if(userData.r)
                                    let user_po = false
                                    if(elem.roles){
                                        for(let role of elem.roles){
                                            if(role.name.includes("PO")) user_po = true
                                        }
                                    }
                                    if(!user_po) return null;
                                    return <UserData rolesCurrUser={props.rolesCurrUser} elem={elem} token={props.token} userToChange={userToChange} setUserToChangeAsync={setUserToChangeAsync} prevUserChanged={prevUserChanged}
                                        setAssignTeamAsync={setAssignTeamAsync} setAssignRoleAsync={setAssignRoleAsync} gettingAllUserData={gettingAllUserData}></UserData>
                                })
                            }
                        </div>
                        <div className="flex top-[2%] left-0 indent-[10px] h-auto w-auto text-slate-400 text-xl font-semibold text-start border-b-4 border-slate-400">Devs</div>
                        <div className="h-auto left-[20px] w-[calc(100%-20px)] grid grid-cols-3 gap-x-2 gap-y-2 mb-2">
                            {
                                userData.map((elem: any, idx: number) => {
                                    // if(userData.r)
                                    let user_dev = false
                                    if(elem.roles){
                                        for(let role of elem.roles){
                                            if(role.name.includes("Dev")) user_dev = true
                                        }
                                    }
                                    if(!user_dev) return null;
                                    return <UserData rolesCurrUser={props.rolesCurrUser} elem={elem} token={props.token} userToChange={userToChange} setUserToChangeAsync={setUserToChangeAsync} prevUserChanged={prevUserChanged}
                                        setAssignTeamAsync={setAssignTeamAsync} setAssignRoleAsync={setAssignRoleAsync} gettingAllUserData={gettingAllUserData}></UserData>
                                })
                            }
                        </div>
                    </div>
                </div>
            }
            
        </div>
    );

    function UserData(props : any) {

        // const [roleToDelete, setRoleToDelete] = useState(null) 
        // const [groupToDelete, setGroupToDelete] = useState(null) 
        
        async function deleteGroup(group : any) {
            try {
                console.log("In delete group")
                console.log("user = " +  JSON.stringify(props.elem) +  ", group1 = " + JSON.stringify(group))

                const userId = props.elem?.user?.id; 
                if (!userId) {
                    console.error("Error: userId is missing!");
                    return;
                } else {
                    console.log("userId = " + userId)
                }

                let response = await fetch(`${authServer}/delete-group`, {
                    method: 'POST',
                    headers: { 
                        "Authorization": `Bearer ${props.token}`,
                        "Content-Type": "application/json",
                    }, 
                    body: JSON.stringify({ userId: props.elem.user.id, group1: group })
                });

                if(!response.ok) {
                    console.error("Could not delete role")
                }

                console.log("Deleted group = " + group.name)
            } catch (error) {
                console.error("Error: " + JSON.stringify(error))
            }
        }

        async function deleteRole(role: any) {
            try {
                
                console.log("In delete group")
                console.log("user = " +  JSON.stringify(props.elem) +  ", group1 = " + JSON.stringify(role))

                const userId = props.elem?.user?.id; 
                if (!userId) {
                    console.error("Error: userId is missing!");
                    return;
                } else {
                    console.log("userId = " + userId)
                }

                let response = await fetch(`${authServer}/delete-role`, {
                    method: 'POST',
                    headers: { 
                        "Authorization": `Bearer ${props.token}`,
                        "Content-Type": "application/json",
                    }, 
                    body: JSON.stringify({ userId: props.elem.user.id, role: role })
                });

                if(!response.ok) {
                    console.error("Could not delete role")
                } else {
                    console.log("Deleted role = " + role.name)
                }
            } catch(error) {
                console.error("Error: " + error)
            }
        }

        function userHasCioRole() {
            if(props.rolesCurrUser) {
                console.log("roles curr user = " + JSON.stringify(props.rolesCurrUser))
                return props.rolesCurrUser.includes("CIO")
                
            } 
            return false
        }

        return (
            <div className="w-full h-auto bg-black bg-opacity-30 flex flex-col gap-3 rounded-xl">
                <div className="flex w-full flex-row h-[100px]">
                    <div className="relative w-[20%] h-full flex flex-row items-center justify-center">
                        <img className="w-[80px] h-[80px] object-contain rounded-full" src="./jonSnow.jpg"></img>
                    </div>
                    <div className="flex w-[40%] text-lg text-white font-semibold indent-[10px] justify-start items-center font-sans">{props.elem.user.firstName} {props.elem.user.lastName}</div>
                    {userHasCioRole() && 
                        <div className="flex w-[40%] h-full flex-col justify-center gap-[10px]">
                            <div className="flex h-[40px] w-[95%] bg-purple-800 text-lg text-white font-sans 
                                rounded-lg justify-center items-center font-semibold hover:cursor-pointer" 
                                onClick={() => {
                                    console.log("User to change = " + JSON.stringify(props.elem))
                                    props.prevUserChanged.current = props.elem; 
                                    props.setUserToChangeAsync(props.elem)
                                    props.setAssignRoleAsync(true)
                                }}>Assign role</div>
                            <div className="flex h-[40px] w-[95%] bg-blue-700 text-lg text-white font-sans 
                            rounded-lg flex-row justify-center items-center font-semibold hover:cursor-pointer" 
                            onClick={() => {
                                console.log("User to change = " + JSON.stringify(props.elem))
                                props.prevUserChanged.current = props.elem; 
                                props.setUserToChangeAsync(props.elem)
                                props.setAssignTeamAsync(true)
                            }}>Assign team</div>
                        </div>
                    }
                </div>
                <div className="flex flex-col w-full">
                    <div className="text-lg font-semibold text-white indent-[10px] font-sans">Roles</div>
                    <div className="flex flex-wrap gap-x-[8px] gap-y-[10px] text-sm font-medium text-gray-500 overflow-x-auto ml-2 mb-2">
                        {
                            props.elem.roles.map((role: any) => {
                                return <div className="flex flex-row w-fit bg-slate-700 rounded-md p-[5px]">
                                            <div className="flex flex-row justify-center items-center">
                                                <div className="text-sm flex flex-row justify-center items-center">{role.name}</div>
                                                {userHasCioRole() && <div className="flex flex-row w-[20px] h-[20px] justify-center items-center hover:cursor-pointer" 
                                                    onClick={async () => {await deleteRole(role); await props.gettingAllUserData()}}>
                                                    <img className="w-[60%] h-[60%] object-contain" src="./grayX.png"></img>
                                                </div>}
                                            </div>
                                        </div>
                            })
                        }
                    </div>
                </div>
                <div className="flex w-full flex-col">
                    <div className="text-lg font-semibold text-white indent-[10px] font-sans">Groups</div>
                    <div className="flex flex-wrap gap-x-[8px] gap-y-[10px] text-gray-500 w-full overflow-x-auto ml-2 mb-2">
                        {
                            props.elem.groups.map((group: any) => {
                                // return <div className=""></div>
                                // return <div className="text-sm font-medium indent-[20px] font-sans">{group.name}</div>
                                return <div className="flex flex-row w-fit bg-slate-700 rounded-md p-[5px]">
                                            <div className="flex flex-row justify-center items-center">
                                                <div className="text-sm flex flex-row justify-center items-center">{group.name}</div>
                                                {userHasCioRole() && <div className="flex flex-row w-[20px] h-[20px] justify-center items-center hover:cursor-pointer" 
                                                    onClick={async () => {await deleteGroup(group) ; await props.gettingAllUserData()}}>
                                                    <img className="w-[60%] h-[60%] object-contain" src="./grayX.png"></img>
                                                </div>}
                                            </div>
                                        </div>
                            })
                        }
                    </div>
                </div>
            </div>
        );
    }
}

function AssignTeam(props: any) {

    const [chosenTeam, chooseTeam] : any = useState(null)
    const [groupsChosen, setGroupsChosen]  = useState<boolean[]>([]);
    const prevChosenTeam = useRef(null)
    const [clickedDropdown, setClickDropdown] = useState(false)
    const [groups, setGroups] = useState<any[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dropdownRef2 = useRef<HTMLDivElement>(null);

    const chooseTeamAsync = async (team: any) => {
        chooseTeam(team)
    }
    
    const setClickDropdownAsync = async (val: boolean) => {
        setClickDropdown(val)
    }

    const setGroupsAsync = async (groups: any) => {
        setGroups(groups)
    }
    
    const setGroupsChosenAsync = async (groups: any) => {
        setGroupsChosen(groups)
    }

    const setGroupChosenAsync = async (idx: number) => {
        console.log("in setGroupsChosenAsync")
        setGroupsChosenAsync((prevState : any) => 
            prevState.map((elem : boolean, idx2 : number) => idx === idx2 ? !elem : elem)
        );
        console.log("after setGroupsChosenAsync")
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef2.current && !dropdownRef2.current.contains(event.target as Node)) {
                props.setAssignTeam(false); // Hide the div when clicking outside
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        
        fetchGroups()

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        console.log("user to change = " + JSON.stringify(props.userToChange))
        console.log("user to change = " + JSON.stringify(props.userToChange))
        console.log("user to change = " + JSON.stringify(props.userToChange))
    }, [props.userToChange])

    async function fetchGroups() {
        try{
            console.log("In fetch groups")
            let response = await fetch(`${authServer}/groups`, {
                method: 'GET',
                headers: { 
                    "Authorization": `Bearer ${props.token}`,
                    "Content-Type": "application/json"
                }, 
            });

            let fetchedGroups = await response.json()
            console.log("groups = " + JSON.stringify(fetchedGroups))
            
            await setGroupsAsync(fetchedGroups.groups)
            setGroupsChosen(new Array(fetchedGroups.groups.length).fill(false));
        } catch(err) {
            console.error("Error: " + JSON.stringify(err))
        }
    }

    
    async function assignTeams() {
        try{
            console.log("========================================")
            console.log("In assign teams")
            console.log("========================================")
            for(let i = 0; i < groups.length ; i++){
                let teamName = ""
                console.log(`groups[${i}] = ` + JSON.stringify(groups[i]))
                if(groupsChosen[i] === true) {
                    teamName = groups[i].name
                    console.log("teamName = " + teamName)
                    let response = await fetch(`${authServer}/assign-team`, {
                        method: 'POST',
                        headers: { 
                            "Authorization": `Bearer ${props.token}`,
                            "Content-Type": "application/json",
                        }, 
                        body: JSON.stringify({ userId: props.userToChange.user.id, teamName: teamName })
                    });

                    if(!response.ok){
                        console.log("Could not assign team to user: " + response.status)
                    } else {
                        console.log("added user to group")
                    }
                }
            }
        }catch(err){
            console.error("Error: " + JSON.stringify(err))
        }
    }


    return (
        <div className="fixed inset-0 flex items-center justify-center">
            <div ref={dropdownRef2} className="rounded-md bg-slate-200 w-[25%] h-[30%] flex flex-col gap-[20px]">
                {/* Header */}
                <div className="h-[20%] w-full flex flex-row justify-center items-center">
                    <div className="text-gray-700 text-base font-semibold">
                        Assign {props.userToChange.user.firstName} {props.userToChange.user.lastName} to team..
                    </div>
                </div>

                {/* Dropdown Container */}
                <div  className="relative h-[50%] w-full flex flex-col justify-center items-center">

                    {/* Dropdown List (Centered) */}
                    <div ref={dropdownRef} className="relative h-full w-[70%] border-[1px] rounded-md bg-slate-500 border-gray-700 text-white 
                    overflow-y-scroll flex flex-col justify-center items-center">
                        {groups.map((elem: any, idx: number) => (
                            <div
                                key={idx}
                                className={`relative w-full h-[1/3] flex flex-row justify-center items-center bg-transparent border-[1px] border-gray-700 
                                hover:bg-slate-600 cursor-pointer 
                                ${idx === 0 ? "rounded-t-md" : idx === groups.length - 1 ? "rounded-b-md" : "rounded-none"}`}
                                onClick={async () => {
                                    await chooseTeamAsync(elem);
                                    // await setClickDropdownAsync(false);
                                }}
                            >
                                <div className="flex-1 text-center hover:cursor-pointer" onClick={() => setGroupChosenAsync(idx)}>
                                    {elem.name}
                                </div>

                                {/* Tick (Only when groupsChosen[idx] is true) */}
                                {groupsChosen[idx] && (
                                    <div className="absolute left-[80%] w-[20%] h-full flex flex-row justify-center items-center">
                                        <img src="./tick.png" className="w-[80%] h-[80%] object-contain"></img>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="h-[30%] w-full flex flex-row justify-center items-center">
                    <div className="flex flex-row justify-center items-center w-[30%] h-[70%] bg-green-700 rounded-md
                    text-white text-sm font-semibold font-sans hover:cursor-pointer border-2 border-gray-700" 
                        onClick={async () => {await assignTeams(); props.gettingAllUserData() ; props.setAssignTeam(false); }}>
                        Apply changes
                    </div>
                </div>
            </div>
        </div>
    );
}


function AssignRole(props: any) {

    const [chosenRole, chooseRole] : any = useState(null)
    const [rolesChosen, setRolesChosen]  = useState<boolean[]>([]);
    const [clickedDropdown, setClickDropdown] = useState(false)
    const [roles, setRoles] = useState<any[]>([])
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dropdownRef2 = useRef<HTMLDivElement>(null);

    const chooseRoleAsync = async (team: any) => {
        chooseRole(team)
    }
    
    const setClickDropdownAsync = async (val: boolean) => {
        setClickDropdown(val)
    }

    const setRolesAsync = async (groups: any) => {
        setRoles(groups)
    }

    const setRolesChosenAsync = async (groups: any) => {
        setRolesChosen(groups)
    }

    const setRoleChosenAsync = async (idx: number) => {
        console.log("in setGroupsChosenAsync")
        setRolesChosenAsync((prevState : any) => 
            prevState.map((elem : boolean, idx2 : number) => idx === idx2 ? !elem : elem)
        );
        console.log("after setGroupsChosenAsync")
    }

    useEffect(() => {
        fetchRoles()

        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef2.current && !dropdownRef2.current.contains(event.target as Node)) {
                console.log("Click outside detected, hiding the dropdown.");
                props.setAssignRole(false); // Hide the div when clicking outside
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [])


    async function fetchRoles() {
        try {
            let response = await fetch(`${authServer}/roles`, {
                method: 'GET',
                headers: { 
                    "Authorization": `Bearer ${props.token}`,
                    "Content-Type": "application/json"
                }, 
            });

            let fetchedRoles = await response.json()
            console.log("roles = " + JSON.stringify(fetchedRoles))
            
            await setRolesAsync(fetchedRoles.roles)
            setRolesChosen(new Array(fetchedRoles.roles.length).fill(false));
        } catch(err) {
            console.log("Error fetching roles " + err)
        }
    }

    async function assignRoles() {
        try{
            console.log("========================================")
            console.log("In assign role")
            console.log("========================================")
            for(let i = 0; i < roles.length ; i++){
                let roleName = ""
                console.log(`roles[${i}] = ` + JSON.stringify(roles[i]))
                if(rolesChosen[i] === true) {
                    roleName = roles[i].name
                    console.log("roleName = " + roleName)
                    let response = await fetch(`${authServer}/assign-role`, {
                        method: 'POST',
                        headers: { 
                            "Authorization": `Bearer ${props.token}`,
                            "Content-Type": "application/json",
                        }, 
                        body: JSON.stringify({ userId: props.userToChange.user.id, roleName: roleName })
                    });

                    if(!response.ok){
                        console.log("Could not assign team to user: " + response.status)
                    } else {
                        console.log("added user to role")
                    }
                }
            }
        }catch(err){
            console.error("Error: " + JSON.stringify(err))
        }
    }

     return (
        <div ref={dropdownRef2} className="fixed w-[25%] h-[30%] flex flex-col gap-[20px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2
            bg-slate-200 rounded-md">
            {/* Header */}
            <div className="h-[20%] w-full flex flex-row justify-center items-center">
                <div className="text-gray-700 text-base font-semibold">
                    Assign {props.userToChange.user.firstName} {props.userToChange.user.lastName} to role..
                </div>
            </div>

            {/* Dropdown Container */}
            <div  className="relative h-[50%] w-full flex flex-col justify-center items-center">

                {/* Dropdown List (Centered) */}
                <div ref={dropdownRef} className="relative h-[260%] w-[70%] border-[1px] rounded-md bg-slate-500 border-gray-700 text-white 
                overflow-y-scroll flex flex-col items-center">
                    {roles.map((elem: any, idx: number) => (
                        <div
                            key={idx}
                            className={`relative w-full h-[1/3] flex flex-row justify-center items-center bg-transparent border-[1px] border-gray-700 
                            hover:bg-slate-600 cursor-pointer 
                            ${idx === 0 ? "rounded-t-md" : idx === roles.length - 1 ? "rounded-b-md" : "rounded-none"}`}
                            onClick={async () => {
                                await chooseRoleAsync(elem);
                                // await setClickDropdownAsync(false);
                            }}
                        >
                            <div className="flex-1 text-center hover:cursor-pointer" onClick={() => setRoleChosenAsync(idx)}>
                                {elem.name}
                            </div>

                            {/* Tick (Only when groupsChosen[idx] is true) */}
                            {rolesChosen[idx] && (
                                <div className="absolute left-[80%] w-[20%] h-full flex flex-row justify-center items-center">
                                    <img src="./tick.png" className="w-[80%] h-[80%] object-contain"></img>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="h-[30%] w-full flex flex-row justify-center items-center">
                <div className="flex flex-row justify-center items-center w-[30%] h-[70%] bg-green-700 rounded-md
                     text-white text-base font-semibold font-sans hover:cursor-pointer border-[2px] border-gray-700" 
                    onClick={async () => {await assignRoles(); props.gettingAllUserData() ; props.setAssignRole(false); }}>
                    Apply changes
                </div>
            </div>
        </div>
    );
}