"use client";

import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

// API URL for the backend server 
const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER || "https://checklist.planmeet.net:5002";

interface DecodedToken {
  realm_access?: { roles?: string[] };
  group?: string[];  // ✅ Fix: Add 'group' field based on actual token
}

export default function Checklists({ token }: { token: string }) {
  const [userRole, setUserRole] = useState<string>("Other"); // Stores the role of the logged-in user
  const [selectedTeam, setSelectedTeam] = useState<string>("dev_team_1"); // Default team for CIO
  const [teams, setTeams] = useState<string[]>([]); // List of available teams (for CIOs)
  const [checklists, setChecklists] = useState<any[]>([]); // Stores checklists for the selected team

  const fetchChecklistsForTeam = async (team: string) => {
    try {
      if (!team) return; // Prevent fetching if no team is selected
      const response = await fetch(`${API_URL}/checklists/team/${team}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      const data = await response.json();

      // ✅ Exclude submitted checklists
      const filteredChecklists = data.filter((item: any) => 
        item.status?.S && 
        (!item.submitted || item.submitted.BOOL === false)
      );

      setChecklists(filteredChecklists); // ✅ Update the checklists dynamically
    } catch (error) {
      console.error("Error fetching checklists:", error);
    }
  }; 

  // Extract user role and assigned team from JWT token
  useEffect(() => {
    try {
      if (!token) return;
      const decoded: DecodedToken = jwtDecode(token || "");
      const roles = decoded?.realm_access?.roles || [];
      const groups = decoded?.group || [];
      console.log("🔍 Extracted groups from token:", groups); // Debugging

      if (roles.includes("CIO")) {
        // CIOs can switch between teams
        setUserRole("CIO");

        // ✅ Extract teams from 'group'
        const teamList = groups.filter((group) => group.startsWith("/dev_team_")).map((g) => g.replace("/", ""));
        
        setTeams(teamList);
        setSelectedTeam(teamList.length > 0 ? teamList[0] : ""); // ✅ Set the first team as default
      } else {
        // Set role to PO or Dev
        setUserRole(roles.includes("PO") ? "PO" : "Dev");
        
        // ✅ Assign only the teams PO/Dev belongs to
        const userTeams = groups.filter((group) => group.startsWith("/dev_team_")).map((g) => g.replace("/", ""));

        setTeams(userTeams);
        setSelectedTeam(userTeams.length > 0 ? userTeams[0] : "");
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }, [token]);

  useEffect(() => {
    if (selectedTeam) {
      console.log("🔄 Fetching checklists for team:", selectedTeam);
      setChecklists([]);  // ✅ Clear previous data before fetching new
      fetchChecklistsForTeam(selectedTeam);
    }
  }, [selectedTeam]);

  return (
    <div className="absolute top-[2%] left-[19%] w-[79%] h-[96%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70">
      
      {/* Team Selection Dropdown */}
      {userRole === "CIO" && (
        <div className="p-4 flex flex-row gap-2 items-center">
          <label className="text-white font-semibold">Viewing Team:</label>
          <select
            className="p-2 bg-black bg-opacity-30 rounded-md"
            value={selectedTeam} 
            onChange={(e) => {
              console.log("🛠 Switching to team:", e.target.value); // Debugging
              setSelectedTeam(e.target.value);
            }}
          >
            {teams.length === 0 ? (
              <option value="">No Teams Available</option> // ✅ Show message if no teams exist
            ) : (
              teams.map((team) => (
                <option key={team} value={team}>
                  {team} 
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Render Checklist Columns (For Selected Team) */}
      <div className="flex flex-row justify-between items-center">
        {[ "Backlog", "Todo", "In progress", "In review", "Done" ].map((title) => (
          <Checklist
            key={title}
            title={title}
            assignedTeam={selectedTeam} // Always pass the selected team
            userRole={userRole}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, assignedTeam, userRole, token }: { title: string; assignedTeam: string; userRole: string; token: string }) {
  const [checklists, setChecklists] = useState<any[]>([]);
  
  const [menuOpen, setMenuOpen] = useState<{ [key: string]: boolean }>({});
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  
  const [showUpdateModal, setShowUpdateModal] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // ✅ Stores the category for new checklists
  const [newChecklistStatus, setNewChecklistStatus] = useState<string>(""); 

  // Fetch checklists **for the selected team**
  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const response = await fetch(`${API_URL}/checklists/team/${assignedTeam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        const filteredChecklists = data.filter((item: any) => 
          item.status?.S === title &&
          (!item.submitted || item.submitted.BOOL === false) // Exclude submitted items
        );

        setChecklists(filteredChecklists);
      } catch (error) {
        console.error("Error fetching checklists:", error);
      }
    };
    fetchChecklists();
  }, [title, assignedTeam, token]);

  // CIO: Delete a checklist with confirmation
  const handleDeleteChecklist = async (id: string) => {
    if (!assignedTeam) return;

    if (!window.confirm("Are you sure you want to delete this checklist?")) return; // Confirmation dialog

    try {
      const response = await fetch(`${API_URL}/checklists/${id}/${assignedTeam}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setChecklists(checklists.filter((item) => item.id.S !== id));
        setConfirmDeleteId(null);
      }
    } catch (error) {
      console.error("Error deleting checklist:", error);
    }
  };

  // PO: Update checklist status
  const handleUpdateStatus = async (id: string) => {

    if (!assignedTeam || !newStatus) return;

    try {
      const oldChecklist = checklists.find((item) => item.id.S === id);
      const oldStatus = oldChecklist.status.S;

      const response = await fetch(`${API_URL}/checklists/${id}/${assignedTeam}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setShowUpdateModal(null);
        setNewStatus("");
        
        // fetchChecklists(); // ✅ Refresh the checklist data
        window.location.reload(); // ✅ Refresh the page immediately after updating
      }
    } catch (error) {
      console.error("Error updating checklist status:", error);
    }
  };

  // CIO correctly adds a new checklist to the selected team
  const handleAddChecklist = async (status: string) => {

    if (!newTitle) {
      alert("Title is required.");
      return;
    }

    console.log("🚀 Adding checklist with status:", status); // ✅ Debugging

    const requestBody = {
      title: newTitle,
      description: newDescription,
      assignedTeam,
      status: newChecklistStatus || "Unknown",
    };

    console.log("🚀 Final request being sent to backend:", JSON.stringify(requestBody, null, 2)); // Debugging

    try {
      const response = await fetch(`${API_URL}/checklists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setShowAddModal(false); // Close the modal after adding successfully
        setNewTitle("");
        setNewDescription("");

        // ✅ Re-fetch checklists to update the UI
        fetchChecklists();
      }
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  const fetchChecklists = async () => {
    try {
      const response = await fetch(`${API_URL}/checklists/team/${assignedTeam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      const data = await response.json();
      const filteredChecklists = data.filter((item: any) => 
        item.status?.S === title && 
        (!item.submitted || item.submitted.BOOL === false) // Exclude submitted items
      );
      setChecklists(filteredChecklists);
    } catch (error) {
      console.error("Error fetching checklists:", error);
    }
  }; 

  const handleModifyChecklist = async (id: string) => {
    if (!editTitle) {
      alert("Title is required.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/checklists/${id}/${assignedTeam}/edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      });

      if (response.ok) {
        setShowEditModal(null);
        // fetchChecklistsForTeam(assignedTeam); 
        fetchChecklists();
      }
    } catch (error) {
      console.error("Error modifying checklist:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element | null; // Type assertion to Element
  
      if (target && !target.closest(".menu-container")) {
        setMenuOpen({}); // Close the menu
      }
    };
  
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);  

  const handleSubmitChecklists = async () => {
    if (!assignedTeam) return;

    try {
      const response = await fetch(`${API_URL}/submission/${assignedTeam}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const responseData = await response.json(); // Extract response body

      if (response.ok) {
        alert("✅ Checklists successfully submitted!");
        fetchChecklists(); // Refresh UI after submission
      } else {
        console.error("❌ Submission failed:", response.status, responseData);
        alert("Submission failed!");
      }
    } catch (error) {
      console.error("Error submitting checklists:", error);
    }
  };

  // const fetchSubmittedChecklists = async () => {
  //   try {
  //     const response = await fetch(`${API_URL}/submissions`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });

  //     if (response.ok) {
  //       const data = await response.json();
  //       setChecklists(data);
  //     } else {
  //       console.error("❌ 
  // Error fetching submitted checklists:", response.statusText);
  //     }
  //   } catch (error) {
  //     console.error("❌ Failed to fetch submitted checklists:", error);
  //   } 
  // }
  
  return (
    <div className="flex flex-col top-[2%] w-[19%] min-h-[96%] bg-black rounded-xl bg-opacity-30 p-3">
      
      {/* Column Header */}
      <div className="flex items-center mb-2">
        <div className={`h-[20px] w-[20px] rounded-full 
          ${title === "Todo" ? "bg-orange-600" : title === "In progress" ? "bg-yellow-400" :
            title === "In review" ? "bg-blue-600" : title === "Done" ? "bg-green-600" : "bg-red-600"}`}>
        </div>
        <span className="ml-2 font-semibold text-white">{title}</span>
      </div>

      {/* Checklist Items */}
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide">
        {checklists.map((checklist, index) => (
          <div key={index} className="bg-gray-300 rounded-md p-3 flex flex-col relative">
            <div className="font-bold text-black">{checklist.title?.S || "No Title"}</div>
            <div className="text-xs text-gray-700">{checklist.description?.S || "No Description"}</div>

            {/* Three-dot menu for CIOs and POs */}
            {(userRole === "CIO" || userRole === "PO") && (
              <div className="absolute top-2 right-2 menu-container">
                <button 
                  className="text-gray-600" 
                  onClick={() => setMenuOpen({ ...menuOpen, [checklist.id.S]: !menuOpen[checklist.id.S] })}
                >
                  ⋮
                </button>
                {menuOpen[checklist.id.S] && (
                  <div className="absolute right-0 mt-1 bg-white shadow-md rounded-md p-2 z-50">
                    {userRole === "CIO" && (
                      <>
                        <button 
                          onClick={() => {
                            setShowEditModal(checklist.id.S);
                            setEditTitle(checklist.title.S);
                            setEditDescription(checklist.description.S);
                          }} 
                          className="text-yellow-500 block px-2 py-1 hover:bg-gray-200 w-full text-left"
                        >
                          Modify
                        </button>

                        <button 
                          onClick={() => handleDeleteChecklist(checklist.id.S)} 
                          className="text-red-500 block px-2 py-1 hover:bg-gray-200 w-full text-left"
                        >  
                          Delete
                        </button>
                      </>
                    )}

                    {userRole === "PO" && (
                      <button 
                        onClick={() => setShowUpdateModal(checklist.id.S)} 
                        className="text-blue-500 block px-2 py-1 hover:bg-gray-200 w-full text-left"
                      >
                        Update 
                      </button>
                    )}
                  </div>
                )}

                {/* Edit Checklist Modal */}
                {showEditModal && (
                  <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded shadow-xl">
                      <h2 className="text-lg font-semibold mb-4">Edit Checklist</h2>
                      <input 
                        type="text" 
                        placeholder="Title" 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)} 
                        className="border p-2 w-full"
                      />
                      <textarea 
                        placeholder="Description" 
                        value={editDescription} 
                        onChange={(e) => setEditDescription(e.target.value)} 
                        className="border p-2 w-full mt-2"
                      />
                      <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setShowEditModal(null)} className="p-2 bg-gray-300 rounded">
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleModifyChecklist(showEditModal)} 
                          className="p-2 bg-yellow-500 text-white rounded"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Checklist Button for CIO */}
      {userRole === "CIO" && (
        <button 
          className="mt-2 p-2 w-full bg-blue-500 text-white rounded hover:bg-blue-600" 
          onClick={() => {
            console.log("✅ Setting newChecklistStatus before opening modal:", title); 
            setNewChecklistStatus(title);
            // setShowAddModal(true);
            // setTimeout(() => setShowAddModal(true), 100);
            setShowAddModal(true);
          }}
        >
          + Add Item
        </button>
      )}

      {userRole === "PO" && title === "Done" && (
        <button
          className="mt-2 p-2 w-full bg-purple-500 text-white rounded hover:bg-purple-600" 
          onClick={handleSubmitChecklists}
        >
          Submit All
        </button>
      )}

      {/* {userRole === "CIO" && (
        <button 
          className="mt-2 p-2 w-full bg-green-500 text-white rounded hover:bg-green-600"
          onClick={fetchSubmittedChecklists}
        >
          View Submitted
        </button>
      )} */}

      {/* Update Status Modal (for PO) */}
      {showUpdateModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Update Checklist Status</h2>
            <select 
              value={newStatus} 
              onChange={(e) => setNewStatus(e.target.value)} 
              className="border p-2 w-full"
            >
              <option value="">Select Status</option>
              <option value="Backlog">Backlog</option>
              <option value="Todo">Todo</option>
              <option value="In progress">In Progress</option>
              <option value="In review">In Review</option>
              <option value="Done">Done</option>
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowUpdateModal(null)} className="p-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={() => handleUpdateStatus(showUpdateModal)} className="p-2 bg-blue-500 text-white rounded">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <input 
              type="text" 
              placeholder="Title" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              className="border p-2 w-full text-gray-700" 
            />
            <textarea 
              placeholder="Description" 
              value={newDescription} 
              onChange={(e) => setNewDescription(e.target.value)} 
              className="border p-2 w-full mt-2 text-gray-700">
            </textarea>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-blue-500 rounded bg-opacity-80">
                Cancel
              </button>
              <button 
                onClick={() => handleAddChecklist(newChecklistStatus)} 
                className="p-2 bg-blue-500 text-white rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}