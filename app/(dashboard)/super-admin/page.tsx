import DashboardStats from "./DashboardStats";

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Overview of all academies and platform statistics.
        </p>
      </div>

      <DashboardStats />
    </div>
  );
}
