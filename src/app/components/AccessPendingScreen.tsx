"use client";

import { Shield, Clock, Mail } from "lucide-react";

export default function AccessPendingScreen() {
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      {/* Glass container */}
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/30 blur-2xl rounded-full" />
            <div className="relative bg-purple-500/10 backdrop-blur-xl border border-purple-500/30 rounded-full p-6">
              <Shield className="w-16 h-16 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white/3 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white text-center mb-3">Truy Cập Bị Từ Chối</h1>
          <p className="text-lg text-purple-300 text-center mb-6">Access Pending Approval</p>

          <div className="space-y-4 mb-8">
            {/* Status */}
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <Clock className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-300 mb-1">
                  Tài khoản đang chờ duyệt
                </div>
                <div className="text-xs text-gray-400">Your account is pending admin approval</div>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-blue-300 mb-1">
                  Chỉ tài khoản được phê duyệt mới có thể truy cập
                </div>
                <div className="text-xs text-gray-400">
                  Only whitelisted accounts can access this application
                </div>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-300">
              Vui lòng đợi quản trị viên phê duyệt tài khoản của bạn.
            </p>
            <p className="text-xs text-gray-500">
              Please wait for an administrator to approve your account access.
            </p>
          </div>

          {/* Sign out button */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <a
              href="/api/auth/signout"
              className="block w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-center text-sm text-gray-300 hover:text-white transition-all"
            >
              Quay Lại Đăng Nhập / Sign Out
            </a>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Nếu bạn nghĩ đây là lỗi, vui lòng liên hệ quản trị viên.
        </p>
      </div>
    </div>
  );
}
