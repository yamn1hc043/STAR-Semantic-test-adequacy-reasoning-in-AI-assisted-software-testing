"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileCode, Archive, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  isLoading?: boolean;
}

export function FileUpload({ onFileSelect, onFileRemove, isLoading = false }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'text/plain': ['.txt', '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.r', '.m', '.pl', '.sh'],
      'text/javascript': ['.js', '.jsx'],
      'text/typescript': ['.ts', '.tsx'],
      'application/javascript': ['.js'],
      'application/typescript': ['.ts'],
      'text/x-python': ['.py'],
      'text/x-java-source': ['.java'],
      'text/x-c': ['.c', '.h'],
      'text/x-c++src': ['.cpp', '.hpp'],
      'text/x-csharp': ['.cs'],
      'text/x-php': ['.php'],
      'text/x-ruby': ['.rb'],
      'text/x-go': ['.go'],
      'text/x-rustsrc': ['.rs'],
      'text/x-swift': ['.swift'],
      'text/x-kotlin': ['.kt'],
      'text/x-scala': ['.scala'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = () => {
    setSelectedFile(null);
    onFileRemove?.();
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.zip')) {
      return <Archive className="h-8 w-8 text-blue-500" />;
    }
    return <FileCode className="h-8 w-8 text-green-500" />;
  };

  const getFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-primary hover:bg-primary/5"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} disabled={isLoading} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? "Drop your file here" : "Upload your code file or project"}
            </h3>
            <p className="text-gray-600 mb-4">
              Drag & drop a file here, or click to select
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <Badge variant="secondary">.zip projects</Badge>
              <Badge variant="secondary">Python (.py)</Badge>
              <Badge variant="secondary">JavaScript (.js/.jsx)</Badge>
              <Badge variant="secondary">TypeScript (.ts/.tsx)</Badge>
              <Badge variant="secondary">Java (.java)</Badge>
              <Badge variant="secondary">C/C++ (.c/.cpp)</Badge>
              <Badge variant="secondary">And more...</Badge>
            </div>
            <p className="text-sm text-gray-500">Maximum file size: 50MB</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info Section */}
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center space-x-4">
                {getFileIcon(selectedFile.name)}
                <div>
                  <p className="font-semibold text-lg text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    Size: {getFileSize(selectedFile.size)} • Ready for analysis
                  </p>
                </div>
              </div>
              {!isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeFile}
                  className="text-gray-500 hover:text-red-500 hover:border-red-300"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}