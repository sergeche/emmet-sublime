'''
@author Sergey Chikuyonok (serge.che@gmail.com)
@link http://chikuyonok.ru
'''
import sys
import os.path
import re

is_python3 = sys.version_info[0] > 2

try:
	if is_python3:
		import urllib.request as urllib2
	else:
		import urllib2
except Exception as e:
	pass

def is_url(path):
	return re.match(r'^https?://', path, re.IGNORECASE)

def read_http(url, size=-1, mode=None):
	response = urllib2.urlopen(url, timeout=5)
	return response.read(size)

def read_file(path, size=-1, mode='rb'):
	kwargs = {}
	if is_python3 and 'b' not in mode:
		kwargs['encoding'] = 'utf-8'

	with open(path, mode, **kwargs) as fp:
		return fp.read(size)

class File():
	def __init__(self):
		pass

	def _read(self, path, size, mode='rb'):
		reader = is_url(path) and read_http or read_file
		return reader(path, size, mode) 

	def read(self, path, size, callback=None):
		"""
		Read file content and return it
		@param path: File's relative or absolute path
		@type path: str
		@return: str
		"""

		try:
			content = self._read(path, size)

			# return as array of character codes since PyV8 may corrupt
			# binary data when python string is translated into JS string
			if is_python3:
				content = [ch for ch in content]
			else:
				content = [ord(ch) for ch in content]

		except Exception as e:
			return callback(str(e), None)

		callback(None, content)

	def read_text(self, path, size, callback=None):
		"""
		Read file content and return it
		@param path: File's relative or absolute path
		@type path: str
		@return: str
		"""

		try:
			content = self._read(path, size, 'r')
			if not is_python3:
				content = content.decode('utf-8')
		except Exception as e:
			return callback(str(e), None)
		
		callback(None, content)

	def locate_file(self, editor_file, file_name):
		"""
		Locate <code>file_name</code> file that relates to <code>editor_file</code>.
		File name may be absolute or relative path
		
		@type editor_file: str
		@type file_name: str
		@return String or None if <code>file_name</code> cannot be located
		"""
		if is_url(file_name):
			return file_name

		result = None
		
		previous_parent = ''
		parent = os.path.dirname(editor_file)
		while parent and os.path.exists(parent) and parent != previous_parent:
			tmp = self.create_path(parent, file_name)
			if os.path.exists(tmp):
				result = tmp
				break
			
			previous_parent = parent
			parent = os.path.dirname(parent)
		
		return result

	def create_path(self, parent, file_name):
		"""
		Creates absolute path by concatenating <code>parent</code> and <code>file_name</code>.
		If <code>parent</code> points to file, its parent directory is used
		
		@type parent: str
		@type file_name: str
		@return: str
		"""
		result = ''
		file_name = file_name.lstrip('/')
		
		if os.path.exists(parent):
			if os.path.isfile(parent):
				parent = os.path.dirname(parent)
				
			result = os.path.normpath(os.path.join(parent, file_name))
		
		return result

	def save(self, file, content):
		"""
		Saves <code>content</code> as <code>file</code>
		
		@param file: File's asolute path
		@type file: str
		@param content: File content
		@type content: str
		"""
		try:
			fp = open(file, 'wb')
		except:
			fdirs, fname = os.path.split(file)
			if fdirs:
				os.makedirs(fdirs)
			fp = open(file, 'wb')
			
		fp.write(content)
		fp.close()

	def get_ext(self, file):
		"""
		Returns file extention in lower case
		@type file: str
		@return: str
		"""
		ext = os.path.splitext(file)[1]
		if ext:
			ext = ext[1:]
		
		return ext.lower()
