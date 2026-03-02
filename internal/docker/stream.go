package docker

import (
	"encoding/binary"
	"io"
	"unicode/utf8"
)

// streamType represents the type of stream in Docker's multiplexed format
type streamType byte

const (
	stdinStream  streamType = 0
	stdoutStream streamType = 1
	stderrStream streamType = 2

	// headerSize is the size of the multiplexed stream header
	headerSize = 8
)

// safeDecodeString ensures the byte slice is valid UTF-8 by replacing
// invalid sequences with the Unicode replacement character.
// This prevents malformed UTF-8 from causing display issues.
func safeDecodeString(b []byte) string {
	if utf8.Valid(b) {
		return string(b)
	}

	// If not valid UTF-8, replace invalid sequences
	var result []rune
	for len(b) > 0 {
		r, size := utf8.DecodeRune(b)
		if r == utf8.RuneError && size == 1 {
			// Invalid UTF-8 sequence, skip it
			result = append(result, utf8.RuneError)
		} else {
			result = append(result, r)
		}
		b = b[size:]
	}
	return string(result)
}

// demultiplexReader reads from a Docker exec stream and demultiplexes
// stdout and stderr into separate buffers
type demultiplexReader struct {
	reader io.Reader
}

// newDemultiplexReader creates a new demultiplex reader
func newDemultiplexReader(r io.Reader) *demultiplexReader {
	return &demultiplexReader{reader: r}
}

// ReadDemux reads from the multiplexed stream and writes to appropriate buffers
// This is equivalent to stdcopy.StdCopy from the Docker SDK
func (d *demultiplexReader) ReadDemux(stdout, stderr io.Writer) error {
	header := make([]byte, headerSize)

	for {
		// Read the 8-byte header
		n, err := io.ReadFull(d.reader, header)
		if err == io.EOF && n == 0 {
			// End of stream, normal completion
			return nil
		}
		if err == io.ErrUnexpectedEOF && n == 0 {
			// Empty or truncated stream
			return nil
		}
		if err != nil {
			return err
		}

		// Parse header: [streamType(1)][size(4)]
		streamType := header[0]
		size := binary.BigEndian.Uint32(header[4:8])

		// Read the payload
		if size > 0 {
			payload := make([]byte, size)
			_, err := io.ReadFull(d.reader, payload)
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return err
			}

			// Write to appropriate writer with safe UTF-8 decoding
			switch streamType {
			case 1: // stdout
				// Apply safe UTF-8 decoding to prevent encoding issues
				decodedPayload := safeDecodeString(payload)
				stdout.Write([]byte(decodedPayload))
			case 2: // stderr
				// Apply safe UTF-8 decoding to prevent encoding issues
				decodedPayload := safeDecodeString(payload)
				stderr.Write([]byte(decodedPayload))
				// stdin (0) is ignored for output
			}
		}
	}
}
