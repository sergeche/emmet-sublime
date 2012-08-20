'''
@author Sergey Chikuyonok (serge.che@gmail.com)
@link http://chikuyonok.ru
'''
import os.path

class File():
	def __init__(self):
		pass

	def read(self, path):
		"""
		Read file content and return it
		@param path: File's relative or absolute path
		@type path: str
		@return: str
		"""
		content = None
		try:
			fp = open(path, 'rb')
			content = fp.read()
			fp.close()
		except:
			pass
		
		# return as array of character codes since PyV8 may corrupt
		# binary data when python string is translated into JS string
		return [ord(ch) for ch in content]

	def locate_file(self, editor_file, file_name):
		"""
		Locate <code>file_name</code> file that relates to <code>editor_file</code>.
		File name may be absolute or relative path
		
		@type editor_file: str
		@type file_name: str
		@return String or None if <code>file_name</code> cannot be located
		"""
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
