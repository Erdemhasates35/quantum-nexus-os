# Important Termux Commands and curl Requests

## Basic Termux Commands

1. **Update package repository**:
   ```bash
   pkg update
   ```

2. **Upgrade installed packages**:
   ```bash
   pkg upgrade
   ```

3. **Install a package**:
   ```bash
   pkg install [package-name]
   ```

4. **List installed packages**:
   ```bash
   pkg list-installed
   ```

5. **Search for a package**:
   ```bash
   pkg search [term]
   ```

6. **Remove a package**:
   ```bash
   pkg uninstall [package-name]
   ```

## curl Requests

1. **Basic GET Request**:
   ```bash
   curl [URL]
   ```

2. **GET Request with custom header**:
   ```bash
   curl -H "Authorization: Bearer [token]" [URL]
   ```

3. **POST Request**:
   ```bash
   curl -X POST [URL] -d 'param1=value1&param2=value2'
   ```

4. **Upload a file**:
   ```bash
   curl -X POST -F 'file=@[filepath]' [URL]
   ```

5. **Download a file**:
   ```bash
   curl -O [URL]
   ```

6. **Follow redirects**:
   ```bash
   curl -L [URL]
   ```

7. **Show response headers**:
   ```bash
   curl -I [URL]
   ```