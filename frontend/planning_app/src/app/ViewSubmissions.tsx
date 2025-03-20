"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER;

export default function ViewSubmissions({ token }: { token: string}) {
    const [submissions, setSubmissions] = useState<any[]>([]);

    // Fetch all submitted checklists
    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
              console.log("📌 Fetching submissions...");
              const response = await fetch(`${API_URL}/submissions`, {
                headers: { Authorization: `Bearer ${token}` },
              });
      
              if (!response.ok) {
                throw new Error("Failed to fetch submissions");
              }
      
              const data = await response.json();
              console.log("✅ Submissions fetched:", data); // Debugging
              setSubmissions(data);
            } catch (error) {
              console.error("Error fetching submissions:", error);
            }
          };

        fetchSubmissions();
    }, [token]);

    function parseTimestamp(val : string) {
        let [date, time] = val.split("T")

        let time1 = time.split(".")[0]

        return time1 + " " + date
    }

    return (
        <div className="absolute top-[2%] left-[19%] w-[79%] h-[96%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70">
            <h2 className="text-xl font-semibold text-white p-4">Submitted Checklists</h2>

            <div className="overflow-y-auto p-4">
                {submissions.length === 0 ? (
                    <p className="text-white">No submissions found.</p>
                ) : (
                    <table className="w-full text-white border-collapse">
                        <thead>
                            <tr className="border-b bg-gray-800">
                                <th className="p-3 text-left">Title</th>
                                <th className="p-3 text-left">Description</th> {/* ✅ Added Description Column */}
                                <th className="p-3 text-left">Team</th>
                                <th className="p-3 text-left">Submitted At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map((submission, index) => (
                                <tr key={index} className="border-b hover:bg-gray-700">
                                    <td className="p-3">{submission.title?.S || "Untitled"}</td>
                                    <td className="p-3 text-gray-300">
                                        {submission.description?.S || "No description provided"} {/* ✅ Display Description */}
                                    </td>
                                    <td className="p-3">{submission.assignedTeam?.S}</td>
                                    <td className="p-3">{parseTimestamp(submission.submittedAt?.S)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}