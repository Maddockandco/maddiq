'use client'

import React from 'react'
import {
  Users,
  CheckSquare,
  Calendar,
  TrendingUp,
} from 'lucide-react'

const stats = [
  {
    label: 'Total Clients',
    value: '0',
    icon: Users,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Open Tasks',
    value: '0',
    icon: CheckSquare,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'Upcoming Deadlines',
    value: '0',
    icon: Calendar,
    color: 'bg-red-50 text-red-600',
  },
  {
    label: 'Pipeline Leads',
    value: '0',
    icon: TrendingUp,
    color: 'bg-green-50 text-green-600',
  },
]

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-dark">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back to Maddiq</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <Icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-dark">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <h2 className="text-lg font-semibold text-brand-dark mb-2">
          Ready to get started? 🚀
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Add your first client to get started with Maddiq
        </p>
