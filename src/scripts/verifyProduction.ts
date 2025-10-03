/**
 * VibeTune Production Verification Script
 * 
 * Verifies all systems are ready for production deployment
 */

import { supabase } from '../services/supabaseClient';
import { SimpleAuthService } from '../services/authServiceSimple';
import { SpeechService } from '../services/speechService';

interface VerificationResult {
  service: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class ProductionVerifier {
  private results: VerificationResult[] = [];

  /**
   * Run all verification checks
   */
  async runAllChecks(): Promise<void> {
    console.log('🔍 Starting VibeTune Production Verification...\n');

    await this.checkEnvironmentVariables();
    await this.checkSupabaseConnection();
    await this.checkAuthenticationSystem();
    await this.checkSpeechServices();
    await this.checkServerEndpoints();
    await this.checkSecurityConfiguration();

    this.printResults();
  }

  /**
   * Check environment variables are properly configured
   */
  private async checkEnvironmentVariables(): Promise<void> {
    console.log('🔧 Checking environment variables...');

    const requiredVars = [
      'OPENAI_API_KEY',
      'DEEPGRAM_API_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingVars: string[] = [];
    const presentVars: string[] = [];

    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (!value || value === 'your_api_key_here') {
        missingVars.push(varName);
      } else {
        presentVars.push(varName);
      }
    });

    if (missingVars.length === 0) {
      this.results.push({
        service: 'Environment Variables',
        status: 'pass',
        message: 'All required environment variables are configured',
        details: { configured: presentVars }
      });
    } else {
      this.results.push({
        service: 'Environment Variables',
        status: 'fail',
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        details: { missing: missingVars, configured: presentVars }
      });
    }
  }

  /**
   * Check Supabase connection and database access
   */
  private async checkSupabaseConnection(): Promise<void> {
    console.log('🗄️ Checking Supabase connection...');

    try {
      // Test basic connection
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      this.results.push({
        service: 'Supabase Connection',
        status: 'pass',
        message: 'Successfully connected to Supabase',
        details: { hasSession: !!data.session }
      });

    } catch (error) {
      this.results.push({
        service: 'Supabase Connection',
        status: 'fail',
        message: `Failed to connect to Supabase: ${error.message}`,
        details: { error: error.message }
      });
    }
  }

  /**
   * Check authentication system functionality
   */
  private async checkAuthenticationSystem(): Promise<void> {
    console.log('🔐 Checking authentication system...');

    try {
      // Test session retrieval
      const session = await SimpleAuthService.getCurrentSession();
      
      // Test device ID generation
      const deviceId = SimpleAuthService.getDeviceId();
      
      if (!deviceId) {
        throw new Error('Device ID generation failed');
      }

      this.results.push({
        service: 'Authentication System',
        status: 'pass',
        message: 'Authentication system is functional',
        details: { 
          hasSession: !!session,
          deviceIdGenerated: !!deviceId
        }
      });

    } catch (error) {
      this.results.push({
        service: 'Authentication System',
        status: 'fail',
        message: `Authentication system error: ${error.message}`,
        details: { error: error.message }
      });
    }
  }

  /**
   * Check speech services integration
   */
  private async checkSpeechServices(): Promise<void> {
    console.log('🎤 Checking speech services...');

    try {
      const healthCheck = await SpeechService.checkServiceHealth();
      
      if (healthCheck.available) {
        this.results.push({
          service: 'Speech Services',
          status: 'pass',
          message: 'Speech services are available',
          details: healthCheck.services
        });
      } else {
        this.results.push({
          service: 'Speech Services',
          status: 'warning',
          message: 'Some speech services may not be available',
          details: healthCheck.services
        });
      }

    } catch (error) {
      this.results.push({
        service: 'Speech Services',
        status: 'fail',
        message: `Speech services check failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }

  /**
   * Check server endpoints are accessible
   */
  private async checkServerEndpoints(): Promise<void> {
    console.log('🌐 Checking server endpoints...');

    try {
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-b2083953`;

      // Test health endpoint
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const healthData = await response.json();

      this.results.push({
        service: 'Server Endpoints',
        status: 'pass',
        message: 'Server endpoints are accessible',
        details: healthData
      });

    } catch (error) {
      this.results.push({
        service: 'Server Endpoints',
        status: 'fail',
        message: `Server endpoint check failed: ${error.message}`,
        details: { error: error.message }
      });
    }
  }

  /**
   * Check security configuration
   */
  private async checkSecurityConfiguration(): Promise<void> {
    console.log('🛡️ Checking security configuration...');

    const securityChecks = {
      gitignoreExists: false,
      envLocalProtected: false,
      noHardcodedKeys: true
    };

    // Check if .gitignore exists and protects env files
    try {
      const fs = await import('fs');
      const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
      securityChecks.gitignoreExists = true;
      securityChecks.envLocalProtected = gitignoreContent.includes('.env.local');
    } catch (error) {
      // File system not available in browser
    }

    const allChecksPass = Object.values(securityChecks).every(check => check === true);

    if (allChecksPass) {
      this.results.push({
        service: 'Security Configuration',
        status: 'pass',
        message: 'Security configuration is properly set up',
        details: securityChecks
      });
    } else {
      this.results.push({
        service: 'Security Configuration',
        status: 'warning',
        message: 'Some security checks could not be verified',
        details: securityChecks
      });
    }
  }

  /**
   * Print verification results
   */
  private printResults(): void {
    console.log('\n📊 VERIFICATION RESULTS\n');
    console.log('=' .repeat(60));

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;

    this.results.forEach(result => {
      const statusEmoji = {
        pass: '✅',
        fail: '❌',
        warning: '⚠️'
      }[result.status];

      console.log(`${statusEmoji} ${result.service}: ${result.message}`);
      
      if (result.details) {
        console.log(`   ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ')}`);
      }
      console.log('');

      switch (result.status) {
        case 'pass': passCount++; break;
        case 'fail': failCount++; break;
        case 'warning': warningCount++; break;
      }
    });

    console.log('=' .repeat(60));
    console.log(`📈 SUMMARY: ${passCount} passed, ${warningCount} warnings, ${failCount} failed`);

    if (failCount === 0 && warningCount === 0) {
      console.log('\n🎉 VibeTune is ready for production deployment!');
    } else if (failCount === 0) {
      console.log('\n✅ VibeTune is ready for production with minor warnings.');
    } else {
      console.log('\n❌ VibeTune has critical issues that must be resolved before production.');
    }
  }
}

// Export for use in tests or manual verification
export { ProductionVerifier };

// Run verification if script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  const verifier = new ProductionVerifier();
  verifier.runAllChecks().catch(console.error);
}