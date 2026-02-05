# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
    channel = "stable-24.11"; 

      # Use https://search.nixos.org/packages to find packages
        packages = [
            pkgs.nodejs_20
                pkgs.zulu
                  ];

                    # Sets environment variables in the workspace
                      env = {
                          # Prefer the non-thinking model for speed and quota efficiency
                              GEMINI_MODEL = "gemini-2.5-flash-lite";
                                };

                                  # Firebase emulators configuration
                                    services.firebase.emulators = {
                                        detect = false;
                                            projectId = "demo-app";
                                                services = ["auth" "firestore"];
                                                  };

                                                    idx = {
                                                        # All extensions must be listed here
                                                            extensions = [
                                                                  "saoudrizwan.claude-dev"      # Cline (formerly Claude Dev)
                                                                        "Google.geminicodeassist"    # Gemini Code Assist
                                                                              "usernamehw.errorlens"       # Error visibility
                                                                                  ];

                                                                                      workspace = {
                                                                                            # Runs when the workspace is first created
                                                                                                  onCreate = {
                                                                                                          # Opens your main file by default
                                                                                                                  default.openFiles = [ "src/app/page.tsx" ];

                                                                                                                          # This block disables AI "Thinking" to stop the lag and quota drain
                                                                                                                                  disable-thinking-settings = ''
                                                                                                                                            mkdir -p .vscode
                                                                                                                                                      cat <<EOF > .vscode/settings.json
                                                                                                                                                                {
                                                                                                                                                                            "FirebaseStudio.ai.thinkingBudget": 0,
                                                                                                                                                                                        "IDX.ai.enableInlineCompletion": false,
                                                                                                                                                                                                    "Geminicodeassist.inlineSuggestions.nextEditPredictions": false,
                                                                                                                                                                                                                "Geminicodeassist.thinking.enabled": false
                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                    EOF
                                                                                                                                                                                                                                            '';
                                                                                                                                                                                                                                                  };
                                                                                                                                                                                                                                                      };

                                                                                                                                                                                                                                                          # Enable previews and customize configuration
                                                                                                                                                                                                                                                              previews = {
                                                                                                                                                                                                                                                                    enable = true;
                                                                                                                                                                                                                                                                          previews = {
                                                                                                                                                                                                                                                                                  web = {
                                                                                                                                                                                                                                                                                            command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
                                                                                                                                                                                                                                                                                                      manager = "web";
                                                                                                                                                                                                                                                                                                              };
                                                                                                                                                                                                                                                                                                                    };
                                                                                                                                                                                                                                                                                                                        };
                                                                                                                                                                                                                                                                                                                          };
                                                                                                                                                                                                                                                                                                                          }