param(
    [int]$Port = 8787
)

$root = $PSScriptRoot
Set-Location $root

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host ""
Write-Host "  AEP Schema Architect - local server"
Write-Host "  -----------------------------------"
Write-Host "  App       : http://localhost:$Port/index.html"
Write-Host "  IMS proxy : http://localhost:$Port/api/token"
Write-Host ""
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

$mimeMap = @{
    ".html" = "text/html"; ".htm" = "text/html"
    ".js"   = "application/javascript"; ".css" = "text/css"
    ".json" = "application/json"; ".png" = "image/png"
    ".jpg"  = "image/jpeg"; ".jpeg" = "image/jpeg"; ".gif" = "image/gif"
    ".svg"  = "image/svg+xml"; ".ico" = "image/x-icon"
    ".woff" = "font/woff"; ".woff2" = "font/woff2"
}

function Add-Cors($response) {
    $response.Headers.Add("Access-Control-Allow-Origin", "http://localhost:$Port")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            if ($request.HttpMethod -eq "OPTIONS") {
                Add-Cors $response
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/api/ping") {
                $body = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok","server":"aep-proxy"}')
                Add-Cors $response
                $response.ContentType = "application/json"
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
                $response.Close()
                continue
            }

            if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/api/token") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                try {
                    $imsResponse = Invoke-WebRequest -Uri "https://ims-na1.adobelogin.com/ims/token/v3" `
                        -Method Post -Body $bodyText -ContentType "application/x-www-form-urlencoded" `
                        -UseBasicParsing -ErrorAction Stop
                    $respBytes = [System.Text.Encoding]::UTF8.GetBytes($imsResponse.Content)
                    Add-Cors $response
                    $response.StatusCode = $imsResponse.StatusCode
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $respBytes.Length
                    $response.OutputStream.Write($respBytes, 0, $respBytes.Length)
                }
                catch {
                    $errResp = $_.Exception.Response
                    $statusCode = 500
                    $errBody = '{"error":"' + $_.Exception.Message.Replace('"', "'") + '"}'
                    if ($errResp) {
                        $statusCode = [int]$errResp.StatusCode
                        $stream = $errResp.GetResponseStream()
                        $sr = New-Object System.IO.StreamReader($stream)
                        $errBody = $sr.ReadToEnd()
                    }
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errBody)
                    Add-Cors $response
                    $response.StatusCode = $statusCode
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $errBytes.Length
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
                $response.Close()
                continue
            }

            $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($urlPath -eq "/") { $urlPath = "/index.html" }
            $filePath = Join-Path $root ($urlPath.TrimStart("/"))

            $fullRoot = [System.IO.Path]::GetFullPath($root)
            if (-not $fullRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
                $fullRoot += [System.IO.Path]::DirectorySeparatorChar
            }
            $fullFilePath = [System.IO.Path]::GetFullPath($filePath)
            $withinRoot = $fullFilePath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)

            if ($withinRoot -and (Test-Path $fullFilePath -PathType Leaf)) {
                $ext = [System.IO.Path]::GetExtension($fullFilePath)
                $contentType = $mimeMap[$ext]
                if (-not $contentType) { $contentType = "application/octet-stream" }
                $fileBytes = [System.IO.File]::ReadAllBytes($fullFilePath)
                Add-Cors $response
                $response.ContentType = $contentType
                $response.ContentLength64 = $fileBytes.Length
                $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            }
            else {
                $response.StatusCode = 404
                $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.ContentLength64 = $notFound.Length
                $response.OutputStream.Write($notFound, 0, $notFound.Length)
            }
            $response.Close()
        }
        catch {
            try { $response.StatusCode = 500; $response.Close() } catch {}
        }
    }
}
finally {
    $listener.Stop()
}
