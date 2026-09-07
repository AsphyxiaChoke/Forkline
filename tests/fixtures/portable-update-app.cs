using System;
using System.IO;
using System.Diagnostics;
using System.Threading;

public static class PortableUpdateFixture {
  public static void Main() {
    var directory = AppDomain.CurrentDomain.BaseDirectory;
    var version = File.ReadAllText(Path.Combine(directory, "resources", "startup.txt"));
    if (version == "fail") return;
    var health = Environment.GetEnvironmentVariable("FORKLINE_ELECTRON_UPDATE_HEALTH_FILE");
    if (String.IsNullOrEmpty(health)) return;
    File.WriteAllText(health, "{\"ready\":true,\"pid\":" + Process.GetCurrentProcess().Id + ",\"actualVersion\":\"" + version + "\"}");
    Thread.Sleep(2000);
  }
}
