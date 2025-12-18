source "https://rubygems.org"

# Fastlane core
gem "fastlane"

# Load plugins from Pluginfile
plugins_path = File.join(File.dirname(__FILE__), 'fastlane', 'Pluginfile')
eval_gemfile(plugins_path) if File.exist?(plugins_path)
