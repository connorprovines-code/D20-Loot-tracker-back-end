import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Dices, LogIn, UserPlus, Mail, Lock } from 'lucide-react';

const Auth = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        onAuthSuccess(data.user);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities.length === 0) {
          setError('An account with this email already exists');
        } else {
          alert('Account created! Please check your email to confirm your account.');
          setIsSignUp(false);
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Dices size={64} className="text-cyan-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Loot Tracker for D20 TTRPGs
          </h1>
          <p className="text-cyan-100">Campaign Manager for D&D, Pathfinder & More</p>
        </div>

        {/* Auth Form */}
        <div className="bg-slate-800 rounded-lg p-8 shadow-2xl border border-slate-700">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setIsSignUp(false);
                setError('');
              }}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                !isSignUp
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <LogIn size={18} />
                Login
              </div>
            </button>
            <button
              onClick={() => {
                setIsSignUp(true);
                setError('');
              }}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                isSignUp
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <UserPlus size={18} />
                Sign Up
              </div>
            </button>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Email</label>
              <div className="relative">
                <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-10 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-10 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm text-slate-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-10 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
            >
              {loading ? (
                <span>Loading...</span>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Login'
              )}
            </button>
          </form>

          {!isSignUp && (
            <div className="mt-4 text-center text-sm text-slate-400">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (email) {
                    supabase.auth.resetPasswordForEmail(email);
                    alert('Password reset email sent! Check your inbox.');
                  } else {
                    alert('Please enter your email first');
                  }
                }}
                className="hover:text-cyan-400 transition-colors"
              >
                Forgot password?
              </a>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Manage your D&D, Pathfinder, or any D20 campaign with real-time collaboration</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
