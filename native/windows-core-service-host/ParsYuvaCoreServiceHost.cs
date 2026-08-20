using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace ParsYuva.WindowsCoreServiceHost
{
    internal sealed class HostConfiguration
    {
        internal string NodeExecutablePath;
        internal string CoreServiceEntrypointPath;
        internal string WorkingDirectory;
        internal string LocalAdminPipeName;
        internal string LocalAdminToken;
        internal string PolicySigningKeyHex;
        internal string PolicyVersion;
        internal string PolicyJournalAuthorityPath;
        internal string ControlPipeName;
        internal string ControlToken;
        internal int RestartLimit;
        internal int RestartWindowSeconds;
        internal int ShutdownTimeoutSeconds;

        private static readonly Regex PipeName = new Regex(
            "^ppt-core-service-[A-Za-z0-9_-]{8,96}$",
            RegexOptions.CultureInvariant | RegexOptions.Compiled);
        private static readonly Regex ControlPipePattern = new Regex(
            "^ppt-core-service-host-control-[A-Za-z0-9_-]{8,96}$",
            RegexOptions.CultureInvariant | RegexOptions.Compiled);
        private static readonly Regex Hex = new Regex(
            "^(?:[0-9a-fA-F]{2}){32,128}$",
            RegexOptions.CultureInvariant | RegexOptions.Compiled);
        private static readonly string[] ExactKeys = new[]
        {
            "schemaVersion", "nodeExecutablePath", "coreServiceEntrypointPath", "workingDirectory",
            "localAdminPipeName", "localAdminToken", "policySigningKeyHex", "policyVersion",
            "policyJournalAuthorityPath", "controlPipeName", "controlToken", "restartLimit",
            "restartWindowSeconds", "shutdownTimeoutSeconds"
        };

        internal static HostConfiguration Parse(byte[] utf8)
        {
            if (utf8 == null || utf8.Length == 0 || utf8.Length > 64 * 1024)
                throw new InvalidDataException("SERVICE_CONFIGURATION_SIZE_INVALID");
            string json = new UTF8Encoding(false, true).GetString(utf8);
            Dictionary<string, object> values;
            try
            {
                values = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 }
                    .Deserialize<Dictionary<string, object>>(json);
            }
            catch (Exception error)
            {
                throw new InvalidDataException("SERVICE_CONFIGURATION_JSON_INVALID", error);
            }
            if (values == null || values.Count != ExactKeys.Length ||
                ExactKeys.Any(key => !values.ContainsKey(key)) || Convert.ToInt32(values["schemaVersion"]) != 1)
                throw new InvalidDataException("SERVICE_CONFIGURATION_KEYS_INVALID");

            var configuration = new HostConfiguration
            {
                NodeExecutablePath = RequiredString(values, "nodeExecutablePath"),
                CoreServiceEntrypointPath = RequiredString(values, "coreServiceEntrypointPath"),
                WorkingDirectory = RequiredString(values, "workingDirectory"),
                LocalAdminPipeName = RequiredString(values, "localAdminPipeName"),
                LocalAdminToken = RequiredString(values, "localAdminToken"),
                PolicySigningKeyHex = RequiredString(values, "policySigningKeyHex"),
                PolicyVersion = RequiredString(values, "policyVersion"),
                PolicyJournalAuthorityPath = RequiredString(values, "policyJournalAuthorityPath"),
                ControlPipeName = RequiredString(values, "controlPipeName"),
                ControlToken = RequiredString(values, "controlToken"),
                RestartLimit = RequiredInteger(values, "restartLimit"),
                RestartWindowSeconds = RequiredInteger(values, "restartWindowSeconds"),
                ShutdownTimeoutSeconds = RequiredInteger(values, "shutdownTimeoutSeconds")
            };
            configuration.Validate();
            return configuration;
        }

        private void Validate()
        {
            NodeExecutablePath = CanonicalAbsolutePath(NodeExecutablePath, true);
            CoreServiceEntrypointPath = CanonicalAbsolutePath(CoreServiceEntrypointPath, true);
            WorkingDirectory = CanonicalAbsolutePath(WorkingDirectory, false);
            PolicyJournalAuthorityPath = CanonicalAbsolutePath(PolicyJournalAuthorityPath, false);
            if (!File.Exists(NodeExecutablePath) || !File.Exists(CoreServiceEntrypointPath) ||
                !Directory.Exists(WorkingDirectory) || !Directory.Exists(Path.GetDirectoryName(PolicyJournalAuthorityPath)))
                throw new InvalidDataException("SERVICE_CONFIGURATION_PATH_NOT_FOUND");
            if (!PipeName.IsMatch(LocalAdminPipeName) || !ControlPipePattern.IsMatch(ControlPipeName))
                throw new InvalidDataException("SERVICE_CONFIGURATION_PIPE_INVALID");
            ValidateSecret(LocalAdminToken, "LOCAL_ADMIN_TOKEN_INVALID");
            ValidateSecret(ControlToken, "CONTROL_TOKEN_INVALID");
            if (!Hex.IsMatch(PolicySigningKeyHex))
                throw new InvalidDataException("POLICY_SIGNING_KEY_INVALID");
            if (PolicyVersion.Length > 256 || PolicyVersion.Trim() != PolicyVersion || HasControlCharacter(PolicyVersion))
                throw new InvalidDataException("POLICY_VERSION_INVALID");
            if (RestartLimit < 0 || RestartLimit > 10 || RestartWindowSeconds < 60 || RestartWindowSeconds > 3600 ||
                ShutdownTimeoutSeconds < 5 || ShutdownTimeoutSeconds > 120)
                throw new InvalidDataException("SERVICE_LIFECYCLE_LIMIT_INVALID");
        }

        private static string CanonicalAbsolutePath(string value, bool mustBeFile)
        {
            if (String.IsNullOrWhiteSpace(value) || value.Trim() != value || HasControlCharacter(value) ||
                !Path.IsPathRooted(value)) throw new InvalidDataException("SERVICE_PATH_INVALID");
            string canonical = Path.GetFullPath(value);
            if (!String.Equals(canonical, value, StringComparison.OrdinalIgnoreCase) ||
                value.StartsWith("\\\\", StringComparison.Ordinal) ||
                value.StartsWith("\\\\?\\", StringComparison.Ordinal) ||
                value.StartsWith("\\\\.\\", StringComparison.Ordinal))
                throw new InvalidDataException("SERVICE_PATH_NOT_CANONICAL_LOCAL");
            if (mustBeFile && value.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal))
                throw new InvalidDataException("SERVICE_FILE_PATH_INVALID");
            return canonical;
        }

        private static string RequiredString(Dictionary<string, object> values, string key)
        {
            object value;
            if (!values.TryGetValue(key, out value) || !(value is string) || String.IsNullOrEmpty((string)value))
                throw new InvalidDataException("SERVICE_CONFIGURATION_VALUE_INVALID:" + key);
            return (string)value;
        }

        private static int RequiredInteger(Dictionary<string, object> values, string key)
        {
            object value;
            int parsed;
            if (!values.TryGetValue(key, out value) || !Int32.TryParse(Convert.ToString(value), out parsed))
                throw new InvalidDataException("SERVICE_CONFIGURATION_VALUE_INVALID:" + key);
            return parsed;
        }

        private static void ValidateSecret(string value, string code)
        {
            int bytes = Encoding.UTF8.GetByteCount(value);
            if (bytes < 32 || bytes > 128 || value.Trim() != value || HasControlCharacter(value))
                throw new InvalidDataException(code);
        }

        private static bool HasControlCharacter(string value)
        {
            return value.Any(character => Char.IsControl(character));
        }
    }

    internal static class ProtectedConfigurationFile
    {
        internal static HostConfiguration Read(string path)
        {
            string canonical = CanonicalFile(path, true);
            byte[] encrypted = File.ReadAllBytes(canonical);
            if (encrypted.Length == 0 || encrypted.Length > 128 * 1024)
                throw new InvalidDataException("PROTECTED_CONFIGURATION_SIZE_INVALID");
            byte[] clear = null;
            try
            {
                clear = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
                return HostConfiguration.Parse(clear);
            }
            finally
            {
                Array.Clear(encrypted, 0, encrypted.Length);
                if (clear != null) Array.Clear(clear, 0, clear.Length);
            }
        }

        internal static void ProvisionFromStandardInput(string outputPath)
        {
            string canonical = CanonicalFile(outputPath, false);
            if (File.Exists(canonical)) throw new IOException("PROTECTED_CONFIGURATION_ALREADY_EXISTS");
            string directory = Path.GetDirectoryName(canonical);
            if (!Directory.Exists(directory)) throw new DirectoryNotFoundException("PROTECTED_CONFIGURATION_DIRECTORY_MISSING");
            string input = Console.In.ReadToEnd();
            byte[] clear = new UTF8Encoding(false, true).GetBytes(input);
            byte[] encrypted = null;
            string temporary = canonical + ".tmp-" + Guid.NewGuid().ToString("N");
            try
            {
                HostConfiguration.Parse(clear);
                encrypted = ProtectedData.Protect(clear, null, DataProtectionScope.LocalMachine);
                using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                    4096, FileOptions.WriteThrough))
                {
                    stream.Write(encrypted, 0, encrypted.Length);
                    stream.Flush(true);
                }
                ApplyMachineOnlyAcl(temporary);
                File.Move(temporary, canonical);
                ApplyMachineOnlyAcl(canonical);
                Read(canonical);
            }
            finally
            {
                Array.Clear(clear, 0, clear.Length);
                if (encrypted != null) Array.Clear(encrypted, 0, encrypted.Length);
                if (File.Exists(temporary)) File.Delete(temporary);
            }
        }

        private static string CanonicalFile(string path, bool mustExist)
        {
            if (String.IsNullOrWhiteSpace(path) || path.Trim() != path || !Path.IsPathRooted(path))
                throw new InvalidDataException("PROTECTED_CONFIGURATION_PATH_INVALID");
            string canonical = Path.GetFullPath(path);
            if (!String.Equals(canonical, path, StringComparison.OrdinalIgnoreCase) ||
                canonical.StartsWith("\\\\", StringComparison.Ordinal) ||
                canonical.StartsWith("\\\\?\\", StringComparison.Ordinal) ||
                canonical.StartsWith("\\\\.\\", StringComparison.Ordinal) ||
                (mustExist && !File.Exists(canonical)))
                throw new InvalidDataException("PROTECTED_CONFIGURATION_PATH_NOT_CANONICAL_LOCAL");
            return canonical;
        }

        private static void ApplyMachineOnlyAcl(string path)
        {
            var system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var administrators = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);
            var current = WindowsIdentity.GetCurrent().User;
            if (current == null) throw new InvalidOperationException("CURRENT_WINDOWS_IDENTITY_UNAVAILABLE");
            var security = new FileSecurity();
            security.SetAccessRuleProtection(true, false);
            security.SetOwner(current);
            security.AddAccessRule(new FileSystemAccessRule(system, FileSystemRights.FullControl,
                AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(administrators, FileSystemRights.FullControl,
                AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(current, FileSystemRights.FullControl,
                AccessControlType.Allow));
            File.SetAccessControl(path, security);
        }
    }

    internal sealed class CoreServiceWindowsService : ServiceBase
    {
        private const string EventSource = "ParsYuva Core Service";
        private readonly string configurationPath;
        private readonly object sync = new object();
        private readonly Queue<DateTime> unexpectedExits = new Queue<DateTime>();
        private HostConfiguration configuration;
        private Process child;
        private Timer restartTimer;
        private bool stopping;

        internal CoreServiceWindowsService(string configurationPath)
        {
            ServiceName = "ParsYuvaCoreService";
            CanStop = true;
            CanShutdown = true;
            AutoLog = false;
            this.configurationPath = configurationPath;
        }

        protected override void OnStart(string[] args)
        {
            lock (sync)
            {
                stopping = false;
                configuration = ProtectedConfigurationFile.Read(configurationPath);
                StartChild();
            }
            WriteEvent("service.started", EventLogEntryType.Information, 1000);
        }

        protected override void OnStop()
        {
            StopChild();
            WriteEvent("service.stopped", EventLogEntryType.Information, 1001);
        }

        protected override void OnShutdown()
        {
            StopChild();
            base.OnShutdown();
        }

        private void StartChild()
        {
            if (stopping || child != null) return;
            var start = new ProcessStartInfo
            {
                FileName = configuration.NodeExecutablePath,
                Arguments = Quote(configuration.CoreServiceEntrypointPath),
                WorkingDirectory = configuration.WorkingDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            start.EnvironmentVariables["PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT"] =
                "\\\\.\\pipe\\" + configuration.LocalAdminPipeName;
            start.EnvironmentVariables["PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN"] = configuration.LocalAdminToken;
            start.EnvironmentVariables["PPT_POLICY_SIGNING_KEY_HEX"] = configuration.PolicySigningKeyHex;
            start.EnvironmentVariables["PPT_POLICY_VERSION"] = configuration.PolicyVersion;
            start.EnvironmentVariables["PPT_POLICY_JOURNAL_AUTHORITY_PATH"] = configuration.PolicyJournalAuthorityPath;
            start.EnvironmentVariables["PPT_CORE_SERVICE_HOST_CONTROL_ENDPOINT"] =
                "\\\\.\\pipe\\" + configuration.ControlPipeName;
            start.EnvironmentVariables["PPT_CORE_SERVICE_HOST_CONTROL_TOKEN"] = configuration.ControlToken;
            var process = new Process { StartInfo = start, EnableRaisingEvents = true };
            process.OutputDataReceived += delegate { };
            process.ErrorDataReceived += delegate { };
            process.Exited += ChildExited;
            if (!process.Start()) throw new InvalidOperationException("CORE_SERVICE_CHILD_START_FAILED");
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            child = process;
            WriteEvent("core-service.child_started", EventLogEntryType.Information, 1002);
        }

        private void ChildExited(object sender, EventArgs args)
        {
            lock (sync)
            {
                if (child != sender) return;
                child.Dispose();
                child = null;
                if (stopping) return;
                DateTime now = DateTime.UtcNow;
                while (unexpectedExits.Count > 0 &&
                    (now - unexpectedExits.Peek()).TotalSeconds > configuration.RestartWindowSeconds)
                    unexpectedExits.Dequeue();
                unexpectedExits.Enqueue(now);
                if (unexpectedExits.Count > configuration.RestartLimit)
                {
                    ExitCode = 1067;
                    WriteEvent("core-service.restart_limit_exceeded", EventLogEntryType.Error, 2001);
                    ThreadPool.QueueUserWorkItem(delegate { try { Stop(); } catch { } });
                    return;
                }
                int delay = Math.Min(30000, 1000 * (1 << Math.Min(unexpectedExits.Count - 1, 5)));
                restartTimer = new Timer(delegate
                {
                    lock (sync)
                    {
                        restartTimer.Dispose();
                        restartTimer = null;
                        if (!stopping) StartChild();
                    }
                }, null, delay, Timeout.Infinite);
                WriteEvent("core-service.restart_scheduled", EventLogEntryType.Warning, 2000);
            }
        }

        private void StopChild()
        {
            Process process;
            HostConfiguration activeConfiguration;
            lock (sync)
            {
                if (stopping) return;
                stopping = true;
                if (restartTimer != null) { restartTimer.Dispose(); restartTimer = null; }
                process = child;
                activeConfiguration = configuration;
            }
            if (process == null || activeConfiguration == null) return;
            bool acknowledged = RequestGracefulShutdown(activeConfiguration);
            if (!process.WaitForExit(activeConfiguration.ShutdownTimeoutSeconds * 1000))
            {
                try { process.Kill(); } catch { }
                process.WaitForExit(5000);
                WriteEvent(acknowledged ? "core-service.shutdown_timeout" : "core-service.shutdown_unavailable",
                    EventLogEntryType.Warning, 2002);
            }
            lock (sync)
            {
                if (child == process) { child.Dispose(); child = null; }
            }
        }

        private static bool RequestGracefulShutdown(HostConfiguration activeConfiguration)
        {
            try
            {
                using (var pipe = new NamedPipeClientStream(".", activeConfiguration.ControlPipeName,
                    PipeDirection.InOut, PipeOptions.None))
                {
                    int timeout = activeConfiguration.ShutdownTimeoutSeconds * 1000;
                    pipe.Connect(timeout);
                    pipe.ReadMode = PipeTransmissionMode.Byte;
                    using (var writer = new StreamWriter(pipe, new UTF8Encoding(false), 1024, true))
                    using (var reader = new StreamReader(pipe, new UTF8Encoding(false, true), false, 1024, true))
                    {
                        writer.NewLine = "\n";
                        writer.WriteLine("{\"protocolVersion\":1,\"command\":\"shutdown\",\"authenticationToken\":\"" +
                            JsonEscape(activeConfiguration.ControlToken) + "\"}");
                        writer.Flush();
                        string response = reader.ReadLine();
                        return String.Equals(response,
                            "{\"protocolVersion\":1,\"ok\":true,\"code\":\"SHUTDOWN_ACCEPTED\"}",
                            StringComparison.Ordinal);
                    }
                }
            }
            catch { return false; }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static string JsonEscape(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private static void WriteEvent(string eventName, EventLogEntryType type, int eventId)
        {
            try { EventLog.WriteEntry(EventSource, eventName, type, eventId); } catch { }
        }
    }

    internal static class Program
    {
        private static int Main(string[] args)
        {
            try
            {
                if (args.Length == 2 && args[0] == "--service")
                {
                    ServiceBase.Run(new CoreServiceWindowsService(Path.GetFullPath(args[1])));
                    return 0;
                }
                if (args.Length == 2 && args[0] == "--provision")
                {
                    ProtectedConfigurationFile.ProvisionFromStandardInput(Path.GetFullPath(args[1]));
                    Console.Out.WriteLine("{\"schemaVersion\":1,\"provisioned\":true}");
                    return 0;
                }
                if (args.Length == 2 && args[0] == "--validate")
                {
                    ProtectedConfigurationFile.Read(Path.GetFullPath(args[1]));
                    Console.Out.WriteLine("{\"schemaVersion\":1,\"valid\":true}");
                    return 0;
                }
                Console.Error.WriteLine("USAGE_INVALID");
                return 64;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error is CryptographicException ?
                    "PROTECTED_CONFIGURATION_INVALID" : "WINDOWS_SERVICE_HOST_FAILED");
                return 1;
            }
        }
    }
}
